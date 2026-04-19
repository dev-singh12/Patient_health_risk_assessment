/**
 * Seed script — 5 patients, 2 doctors, rich clinical history.
 * Run via: npm run db:seed
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcrypt";
import * as schema from "./schema";
import { users, patients, clinicalData, riskAssessments, healthReports } from "./schema";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const pgClient = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(pgClient, { schema });

const SALT_ROUNDS = 10;
type SmokingStatus = "NEVER" | "FORMER" | "CURRENT";
type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

// ── Risk engine (mirrors riskEngine.ts) ──────────────────────────────────
function computeRisk(m: {
  age: number; bloodPressure: number; glucoseLevel: number;
  bmi: number; cholesterol: number; smokingStatus: SmokingStatus;
}): { riskScore: number; riskLevel: RiskLevel } {
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  const raw =
    clamp(m.age / 100, 0, 1) * 20 +
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

function summary(level: RiskLevel, score: number): string {
  const s = score.toFixed(1);
  return {
    LOW:      `Risk score: ${s}/100 (LOW). Clinical indicators within healthy ranges. Routine annual monitoring recommended.`,
    MODERATE: `Risk score: ${s}/100 (MODERATE). Elevated indicators detected. Lifestyle modifications and closer monitoring advised.`,
    HIGH:     `Risk score: ${s}/100 (HIGH). Multiple risk factors significantly elevated. Clinical intervention and specialist referral recommended.`,
    CRITICAL: `Risk score: ${s}/100 (CRITICAL). Severely elevated risk factors across multiple domains. Immediate medical attention required.`,
  }[level];
}

function recs(level: RiskLevel): string[] {
  return {
    LOW:      ["Maintain healthy lifestyle.", "Annual wellness check-up.", "Regular physical activity (≥150 min/week)."],
    MODERATE: ["Increase physical activity.", "Heart-healthy diet — reduce saturated fats.", "Monitor BP and glucose every 3 months.", "Consider smoking cessation if applicable."],
    HIGH:     ["Initiate pharmacological management for hypertension/dyslipidaemia.", "Specialist referral (cardiologist/endocrinologist).", "Smoking cessation programme.", "Follow-up within 4 weeks."],
    CRITICAL: ["Immediate clinical review — urgent specialist referral.", "Intensive pharmacological therapy.", "Continuous monitoring of BP, glucose, cardiac markers.", "Hospitalisation may be warranted."],
  }[level];
}

// ── Seed data ─────────────────────────────────────────────────────────────

const STAFF = [
  { name: "Dr. Sarah Collins", email: "staff2@hospital.com", password: "Staff2@123" },
  { name: "Dr. Brian Patel",   email: "staff1@hospital.com", password: "Staff@123"  },
];

type ClinicalRecord = {
  age: number; bloodPressure: number; glucoseLevel: number;
  bmi: number; cholesterol: number; smokingStatus: SmokingStatus;
  daysAgo: number; // used to back-date records for realistic history
};

const PATIENTS: Array<{
  name: string; email: string; password: string;
  age: number; medicalHistory: string;
  records: ClinicalRecord[];
}> = [
  {
    name: "Charlie Low",
    email: "charlie@patient.com",
    password: "Charlie@123",
    age: 25,
    medicalHistory: "No significant medical history. Non-smoker. Active lifestyle.",
    records: [
      { age: 25, bloodPressure: 90,  glucoseLevel: 80,  bmi: 22.0, cholesterol: 160, smokingStatus: "NEVER",   daysAgo: 90 },
      { age: 25, bloodPressure: 92,  glucoseLevel: 82,  bmi: 22.2, cholesterol: 162, smokingStatus: "NEVER",   daysAgo: 60 },
      { age: 25, bloodPressure: 88,  glucoseLevel: 79,  bmi: 21.8, cholesterol: 158, smokingStatus: "NEVER",   daysAgo: 30 },
      { age: 25, bloodPressure: 91,  glucoseLevel: 81,  bmi: 22.1, cholesterol: 161, smokingStatus: "NEVER",   daysAgo: 0  },
    ],
  },
  {
    name: "Diana Moderate",
    email: "diana@patient.com",
    password: "Diana@123",
    age: 45,
    medicalHistory: "Mild hypertension diagnosed 2 years ago. Family history of type 2 diabetes. Former smoker (quit 3 years ago).",
    records: [
      { age: 45, bloodPressure: 138, glucoseLevel: 118, bmi: 28.5, cholesterol: 220, smokingStatus: "FORMER",  daysAgo: 120 },
      { age: 45, bloodPressure: 135, glucoseLevel: 115, bmi: 28.0, cholesterol: 215, smokingStatus: "FORMER",  daysAgo: 90  },
      { age: 45, bloodPressure: 132, glucoseLevel: 112, bmi: 27.5, cholesterol: 212, smokingStatus: "FORMER",  daysAgo: 60  },
      { age: 45, bloodPressure: 130, glucoseLevel: 110, bmi: 27.0, cholesterol: 210, smokingStatus: "FORMER",  daysAgo: 30  },
      { age: 45, bloodPressure: 128, glucoseLevel: 108, bmi: 26.8, cholesterol: 208, smokingStatus: "FORMER",  daysAgo: 0   },
    ],
  },
  {
    name: "Edward High",
    email: "edward@patient.com",
    password: "Edward@123",
    age: 60,
    medicalHistory: "Type 2 diabetes (10 years). Hypertension. Current smoker (40 pack-years). Elevated LDL cholesterol.",
    records: [
      { age: 60, bloodPressure: 162, glucoseLevel: 168, bmi: 33.0, cholesterol: 258, smokingStatus: "CURRENT", daysAgo: 90 },
      { age: 60, bloodPressure: 158, glucoseLevel: 162, bmi: 32.5, cholesterol: 252, smokingStatus: "CURRENT", daysAgo: 60 },
      { age: 60, bloodPressure: 155, glucoseLevel: 160, bmi: 32.0, cholesterol: 250, smokingStatus: "CURRENT", daysAgo: 30 },
      { age: 60, bloodPressure: 153, glucoseLevel: 158, bmi: 31.8, cholesterol: 248, smokingStatus: "CURRENT", daysAgo: 0  },
    ],
  },
  // ── 2 new patients ────────────────────────────────────────────────────
  {
    name: "Fatima Critical",
    email: "fatima@patient.com",
    password: "Fatima@123",
    age: 72,
    medicalHistory: "Severe coronary artery disease. Chronic kidney disease stage 3. Type 2 diabetes (20 years). Current smoker. Obesity (BMI 39).",
    records: [
      { age: 72, bloodPressure: 185, glucoseLevel: 228, bmi: 39.5, cholesterol: 295, smokingStatus: "CURRENT", daysAgo: 60 },
      { age: 72, bloodPressure: 182, glucoseLevel: 222, bmi: 39.0, cholesterol: 292, smokingStatus: "CURRENT", daysAgo: 30 },
      { age: 72, bloodPressure: 180, glucoseLevel: 220, bmi: 38.8, cholesterol: 290, smokingStatus: "CURRENT", daysAgo: 0  },
    ],
  },
  {
    name: "George Recovering",
    email: "george@patient.com",
    password: "George@123",
    age: 38,
    medicalHistory: "Post-cardiac event (6 months ago). On statins and beta-blockers. Former heavy smoker (quit after cardiac event). Actively improving lifestyle.",
    records: [
      { age: 38, bloodPressure: 148, glucoseLevel: 125, bmi: 30.0, cholesterol: 235, smokingStatus: "FORMER",  daysAgo: 150 },
      { age: 38, bloodPressure: 142, glucoseLevel: 120, bmi: 29.0, cholesterol: 225, smokingStatus: "FORMER",  daysAgo: 90  },
      { age: 38, bloodPressure: 136, glucoseLevel: 115, bmi: 28.0, cholesterol: 215, smokingStatus: "FORMER",  daysAgo: 60  },
      { age: 38, bloodPressure: 130, glucoseLevel: 110, bmi: 27.0, cholesterol: 205, smokingStatus: "FORMER",  daysAgo: 30  },
      { age: 38, bloodPressure: 125, glucoseLevel: 105, bmi: 26.5, cholesterol: 198, smokingStatus: "FORMER",  daysAgo: 0   },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Starting seed…\n");

  // Wipe in FK-safe order
  await db.delete(healthReports);
  await db.delete(riskAssessments);
  await db.delete(clinicalData);
  await db.delete(patients);
  await db.delete(users);
  console.log("   Cleared existing data.\n");

  // ── Staff / doctors ───────────────────────────────────────────────────
  console.log("👨‍⚕️  Creating staff accounts…");
  for (const s of STAFF) {
    await db.insert(users).values({
      name: s.name, email: s.email,
      password: await bcrypt.hash(s.password, SALT_ROUNDS),
      role: "HEALTHCARE_STAFF",
    });
    console.log(`   ✓ ${s.name} — ${s.email} / ${s.password}`);
  }

  // ── Patients ──────────────────────────────────────────────────────────
  console.log("\n🧑‍🤝‍🧑  Creating patients…");
  const patientIds: Record<string, string> = {};

  for (const p of PATIENTS) {
    const [user] = await db.insert(users).values({
      name: p.name, email: p.email,
      password: await bcrypt.hash(p.password, SALT_ROUNDS),
      role: "PATIENT",
    }).returning();

    const [patient] = await db.insert(patients).values({
      userId: user.userId, age: p.age, medicalHistory: p.medicalHistory,
    }).returning();

    patientIds[p.name] = patient.patientId;
    console.log(`\n   ✓ ${p.name} — ${p.email} / ${p.password}`);
    console.log(`     patientId: ${patient.patientId}`);

    // Insert clinical records (back-dated)
    for (const m of p.records) {
      const recordDate = new Date();
      recordDate.setDate(recordDate.getDate() - m.daysAgo);

      await db.insert(clinicalData).values({
        patientId: patient.patientId,
        metrics: {
          age: m.age, bloodPressure: m.bloodPressure,
          glucoseLevel: m.glucoseLevel, bmi: m.bmi,
          cholesterol: m.cholesterol, smokingStatus: m.smokingStatus,
        } as Record<string, unknown>,
        createdAt: recordDate,
        updatedAt: recordDate,
      });
    }
    console.log(`     ✓ ${p.records.length} clinical records`);

    // Create one assessment + report per clinical record (full history)
    for (const m of p.records) {
      const { riskScore, riskLevel } = computeRisk(m);
      const recordDate = new Date();
      recordDate.setDate(recordDate.getDate() - m.daysAgo);

      const [assessment] = await db.insert(riskAssessments).values({
        patientId: patient.patientId,
        riskScore, riskLevel, status: "COMPLETED",
        createdAt: recordDate,
        updatedAt: recordDate,
      }).returning();

      await db.insert(healthReports).values({
        assessmentId: assessment.assessmentId,
        summary: summary(riskLevel, riskScore),
        recommendations: recs(riskLevel),
        createdAt: recordDate,
        updatedAt: recordDate,
      });
    }
    const latest = computeRisk(p.records[p.records.length - 1]);
    console.log(`     ✓ ${p.records.length} assessments — latest: ${latest.riskLevel} (${latest.riskScore.toFixed(1)})`);
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────");
  console.log("✅  Seed complete!\n");
  console.log("🔑  Login credentials:\n");
  console.log("  DOCTORS (HEALTHCARE_STAFF):");
  for (const s of STAFF) {
    console.log(`    ${s.email.padEnd(28)} ${s.password}`);
  }
  console.log("\n  PATIENTS:");
  for (const p of PATIENTS) {
    console.log(`    ${p.email.padEnd(28)} ${p.password}   patientId: ${patientIds[p.name]}`);
  }
  console.log("─────────────────────────────────────────\n");
}

main()
  .catch((e) => { console.error("❌  Seed failed:", e); process.exit(1); })
  .finally(() => pgClient.end());
