/**
 * Drizzle seed script — inserts deterministic demo data for all four risk levels.
 * Run via: npx ts-node src/db/seed.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcrypt";
import * as schema from "./schema";
import { users, patients, clinicalData, riskAssessments, healthReports } from "./schema";

// Load env manually (ts-node doesn't auto-load .env)
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const pgClient = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(pgClient, { schema });

const SALT_ROUNDS = 10;

type SmokingStatus = "NEVER" | "FORMER" | "CURRENT";
type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

function computeRiskScore(m: {
  age: number; bloodPressure: number; glucoseLevel: number;
  bmi: number; cholesterol: number; smokingStatus: SmokingStatus;
}): { riskScore: number; riskLevel: RiskLevel } {
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  const raw =
    clamp((m.age) / 100, 0, 1) * 20 +
    clamp((m.bloodPressure - 80) / 120, 0, 1) * 20 +
    clamp((m.glucoseLevel - 70) / 230, 0, 1) * 20 +
    clamp((m.bmi - 18.5) / 21.5, 0, 1) * 15 +
    clamp((m.cholesterol - 150) / 150, 0, 1) * 15 +
    (m.smokingStatus === "CURRENT" ? 1 : m.smokingStatus === "FORMER" ? 0.5 : 0) * 10;
  const riskScore = clamp(raw, 0, 100);
  const riskLevel: RiskLevel =
    riskScore >= 75 ? "CRITICAL" : riskScore >= 50 ? "HIGH" : riskScore >= 25 ? "MODERATE" : "LOW";
  return { riskScore, riskLevel };
}

function summaryFor(level: RiskLevel, score: number): string {
  const s = score.toFixed(1);
  const msgs: Record<RiskLevel, string> = {
    LOW: `Risk score: ${s}/100 (LOW). Clinical indicators within healthy ranges. Routine monitoring recommended.`,
    MODERATE: `Risk score: ${s}/100 (MODERATE). Elevated indicators detected. Lifestyle modifications advised.`,
    HIGH: `Risk score: ${s}/100 (HIGH). Multiple risk factors elevated. Clinical intervention recommended.`,
    CRITICAL: `Risk score: ${s}/100 (CRITICAL). Severely elevated risk factors. Immediate attention required.`,
  };
  return msgs[level];
}

function recsFor(level: RiskLevel): string[] {
  const r: Record<RiskLevel, string[]> = {
    LOW: ["Maintain healthy lifestyle.", "Annual wellness check-up.", "Regular physical activity."],
    MODERATE: ["Increase physical activity.", "Heart-healthy diet.", "Monitor BP and glucose every 3 months."],
    HIGH: ["Initiate pharmacological management.", "Specialist referral.", "Smoking cessation programme."],
    CRITICAL: ["Immediate clinical review.", "Intensive pharmacological therapy.", "Continuous monitoring."],
  };
  return r[level];
}

const STAFF = [
  { name: "Dr. Alice Morgan", email: "staff1@hospital.com", password: "Staff@123" },
  { name: "Dr. Brian Patel",  email: "staff2@hospital.com", password: "Staff@123" },
];

const PATIENTS = [
  {
    name: "Charlie Low", email: "patient1@example.com", password: "Patient@123",
    age: 25, medicalHistory: "No significant medical history.",
    records: [
      { age: 25, bloodPressure: 90, glucoseLevel: 80, bmi: 22, cholesterol: 160, smokingStatus: "NEVER" as SmokingStatus },
      { age: 25, bloodPressure: 95, glucoseLevel: 85, bmi: 23, cholesterol: 170, smokingStatus: "NEVER" as SmokingStatus },
    ],
  },
  {
    name: "Diana Moderate", email: "patient2@example.com", password: "Patient@123",
    age: 45, medicalHistory: "Mild hypertension. Family history of type 2 diabetes.",
    records: [
      { age: 45, bloodPressure: 130, glucoseLevel: 110, bmi: 27, cholesterol: 210, smokingStatus: "FORMER" as SmokingStatus },
      { age: 45, bloodPressure: 125, glucoseLevel: 105, bmi: 26, cholesterol: 200, smokingStatus: "FORMER" as SmokingStatus },
    ],
  },
  {
    name: "Edward High", email: "patient3@example.com", password: "Patient@123",
    age: 60, medicalHistory: "Type 2 diabetes. Hypertension. Current smoker.",
    records: [
      { age: 60, bloodPressure: 155, glucoseLevel: 160, bmi: 32, cholesterol: 250, smokingStatus: "CURRENT" as SmokingStatus },
      { age: 75, bloodPressure: 180, glucoseLevel: 220, bmi: 38, cholesterol: 290, smokingStatus: "CURRENT" as SmokingStatus },
    ],
  },
];

async function main() {
  console.log("🌱  Starting seed…");

  // Wipe in FK-safe order
  await db.delete(healthReports);
  await db.delete(riskAssessments);
  await db.delete(clinicalData);
  await db.delete(patients);
  await db.delete(users);
  console.log("   Cleared existing data.");

  // Staff users
  for (const s of STAFF) {
    await db.insert(users).values({
      name: s.name, email: s.email,
      password: await bcrypt.hash(s.password, SALT_ROUNDS),
      role: "HEALTHCARE_STAFF",
    });
    console.log(`   ✓ Staff: ${s.email}`);
  }

  // Patients
  for (const p of PATIENTS) {
    const hashedPw = await bcrypt.hash(p.password, SALT_ROUNDS);

    const [user] = await db.insert(users).values({
      name: p.name, email: p.email, password: hashedPw, role: "PATIENT",
    }).returning();

    const [patient] = await db.insert(patients).values({
      userId: user.userId, age: p.age, medicalHistory: p.medicalHistory,
    }).returning();

    console.log(`   ✓ Patient: ${p.email} (${patient.patientId})`);

    for (const m of p.records) {
      await db.insert(clinicalData).values({
        patientId: patient.patientId,
        metrics: m as Record<string, unknown>,
      });
    }
    console.log(`     ✓ ${p.records.length} clinical record(s)`);

    const { riskScore, riskLevel } = computeRiskScore(p.records[0]);
    const [assessment] = await db.insert(riskAssessments).values({
      patientId: patient.patientId,
      riskScore, riskLevel, status: "COMPLETED",
    }).returning();

    await db.insert(healthReports).values({
      assessmentId: assessment.assessmentId,
      summary: summaryFor(riskLevel, riskScore),
      recommendations: recsFor(riskLevel),
    });
    console.log(`     ✓ Assessment (${riskLevel}, ${riskScore.toFixed(1)}) + report`);
  }

  console.log("\n✅  Seed complete.");
}

main()
  .catch((e) => { console.error("❌  Seed failed:", e); process.exit(1); })
  .finally(() => pgClient.end());
