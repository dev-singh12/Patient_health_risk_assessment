/**
 * Integration tests — Reports endpoints
 *
 * Tests the full API-to-database flow for:
 *   - GET /reports/:patientId
 *   - GET /assessments/:patientId
 *
 * Requires a real PostgreSQL database. Tests are skipped when DATABASE_URL
 * is not set in the environment.
 *
 * Validates: Requirements 13.3, 7.5
 * Property 13: Report Ordering Invariant
 * Property 7: Soft-Deleted Records Excluded from Queries
 */

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import { prisma } from "../../config/db";

// ---------------------------------------------------------------------------
// Skip guard — skip the entire suite when no test DB is available
// ---------------------------------------------------------------------------

const TEST_DB_URL = process.env.DATABASE_URL;
const skipIfNoDb = TEST_DB_URL ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function getStaffToken(): string {
  return jwt.sign(
    { userId: "test-staff-id", role: "HEALTHCARE_STAFF" },
    process.env.JWT_SECRET || "test-secret",
    { expiresIn: "1h" },
  );
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

skipIfNoDb("GET /reports/:patientId and GET /assessments/:patientId — integration", () => {
  let staffToken: string;

  const createdPatientIds: string[] = [];
  const createdUserIds: string[] = [];

  async function createTestPatient(): Promise<string> {
    const email = `test-report-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

    const res = await request(app)
      .post("/patients")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        name: "Report Test Patient",
        email,
        password: "SecurePass1!",
        age: 40,
        medicalHistory: "No known conditions",
      });

    if (res.status !== 201) {
      throw new Error(`Failed to create test patient: ${JSON.stringify(res.body)}`);
    }

    createdPatientIds.push(res.body.patientId);
    createdUserIds.push(res.body.userId);
    return res.body.patientId as string;
  }

  beforeAll(async () => {
    staffToken = getStaffToken();
  });

  afterAll(async () => {
    if (createdPatientIds.length > 0) {
      await prisma.healthReport.deleteMany({
        where: { assessment: { patientId: { in: createdPatientIds } } },
      });
      await prisma.riskAssessment.deleteMany({
        where: { patientId: { in: createdPatientIds } },
      });
      await prisma.clinicalData.deleteMany({
        where: { patientId: { in: createdPatientIds } },
      });
      await prisma.patient.deleteMany({
        where: { patientId: { in: createdPatientIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
    }
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  // GET /reports/:patientId — returns reports ordered by createdAt DESC (Property 13)
  // -------------------------------------------------------------------------

  describe("GET /reports/:patientId — ordering (Property 13)", () => {
    it("returns HTTP 200 with reports ordered by createdAt descending", async () => {
      const patientId = await createTestPatient();

      // Seed multiple health reports directly in DB
      const assessment1 = await prisma.riskAssessment.create({
        data: {
          patientId,
          riskScore: 20,
          riskLevel: "LOW",
          status: "COMPLETED",
        },
      });

      const assessment2 = await prisma.riskAssessment.create({
        data: {
          patientId,
          riskScore: 60,
          riskLevel: "HIGH",
          status: "COMPLETED",
        },
      });

      // Create reports with a small delay to ensure different timestamps
      await prisma.healthReport.create({
        data: {
          assessmentId: assessment1.assessmentId,
          summary: "First report",
          recommendations: ["Recommendation 1"],
        },
      });

      // Small delay to ensure different createdAt
      await new Promise((resolve) => setTimeout(resolve, 10));

      await prisma.healthReport.create({
        data: {
          assessmentId: assessment2.assessmentId,
          summary: "Second report",
          recommendations: ["Recommendation 2"],
        },
      });

      const res = await request(app)
        .get(`/reports/${patientId}`)
        .set("Authorization", `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      // Verify ordering: most recent first
      const dates = res.body.map((r: { createdAt: string }) => new Date(r.createdAt).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });
  });

  // -------------------------------------------------------------------------
  // GET /reports/:patientId — excludes soft-deleted reports (Property 7)
  // -------------------------------------------------------------------------

  describe("GET /reports/:patientId — soft-deleted exclusion (Property 7)", () => {
    it("excludes assessments with deletedAt set from reports query", async () => {
      const patientId = await createTestPatient();

      // Create an assessment and report
      const assessment = await prisma.riskAssessment.create({
        data: {
          patientId,
          riskScore: 30,
          riskLevel: "MODERATE",
          status: "COMPLETED",
        },
      });

      await prisma.healthReport.create({
        data: {
          assessmentId: assessment.assessmentId,
          summary: "Report to be soft-deleted",
          recommendations: ["Rec 1"],
        },
      });

      // Soft-delete the assessment
      await prisma.riskAssessment.update({
        where: { assessmentId: assessment.assessmentId },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .get(`/reports/${patientId}`)
        .set("Authorization", `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // The report linked to the soft-deleted assessment should not appear
      const reportIds = res.body.map((r: { assessmentId: string }) => r.assessmentId);
      expect(reportIds).not.toContain(assessment.assessmentId);
    });
  });

  // -------------------------------------------------------------------------
  // GET /assessments/:patientId — returns assessments list
  // -------------------------------------------------------------------------

  describe("GET /assessments/:patientId", () => {
    it("returns HTTP 200 with an array of assessments", async () => {
      const patientId = await createTestPatient();

      // Seed an assessment
      await prisma.riskAssessment.create({
        data: {
          patientId,
          riskScore: 45,
          riskLevel: "MODERATE",
          status: "COMPLETED",
        },
      });

      const res = await request(app)
        .get(`/assessments/${patientId}`)
        .set("Authorization", `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // GET /reports/:patientId — RBAC enforcement
  // -------------------------------------------------------------------------

  describe("GET /reports/:patientId — RBAC", () => {
    it("returns HTTP 403 when PATIENT accesses another patient's reports", async () => {
      const patientId = await createTestPatient();

      const patientToken = jwt.sign(
        { userId: "different-patient-id", role: "PATIENT" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "1h" },
      );

      const res = await request(app)
        .get(`/reports/${patientId}`)
        .set("Authorization", `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
    });

    it("returns HTTP 401 when no token is provided", async () => {
      const patientId = await createTestPatient();

      const res = await request(app).get(`/reports/${patientId}`);

      expect(res.status).toBe(401);
    });
  });
});
