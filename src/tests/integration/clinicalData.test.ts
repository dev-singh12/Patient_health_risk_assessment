/**
 * Integration tests — Clinical Data endpoints
 *
 * Tests the full API-to-database flow for:
 *   - POST /clinical-data
 *
 * Requires a real PostgreSQL database. Tests are skipped when DATABASE_URL
 * is not set in the environment.
 *
 * Validates: Requirements 13.3, 4.1, 4.2, 4.3
 * Property 8: Validation Rejects Missing Required Fields (Requirements 4.2, 10.2)
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

async function getStaffToken(): Promise<string> {
  return jwt.sign(
    { userId: "test-staff-id", role: "HEALTHCARE_STAFF" },
    process.env.JWT_SECRET || "test-secret",
    { expiresIn: "1h" },
  );
}

// ---------------------------------------------------------------------------
// Valid metrics fixture
// ---------------------------------------------------------------------------

const validMetrics = {
  age: 45,
  bloodPressure: 120,
  glucoseLevel: 95,
  bmi: 24.5,
  cholesterol: 190,
  smokingStatus: "NEVER",
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

skipIfNoDb("POST /clinical-data — integration", () => {
  let staffToken: string;

  // Track created records for cleanup
  const createdClinicalDataIds: string[] = [];
  const createdPatientIds: string[] = [];
  const createdUserIds: string[] = [];

  /**
   * Helper: create a patient via the API and track it for cleanup.
   * Returns the created patientId.
   */
  async function createTestPatient(): Promise<string> {
    const email = `test-cd-patient-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

    const res = await request(app)
      .post("/patients")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        name: "Clinical Data Test Patient",
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
    staffToken = await getStaffToken();
  });

  afterAll(async () => {
    // Clean up in reverse FK order: clinical_data → patients → users
    if (createdClinicalDataIds.length > 0) {
      await prisma.clinicalData.deleteMany({
        where: { clinicalId: { in: createdClinicalDataIds } },
      });
    }
    if (createdPatientIds.length > 0) {
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
  // POST /clinical-data — success
  // -------------------------------------------------------------------------

  describe("POST /clinical-data — success", () => {
    it("returns HTTP 201 and persists the clinical data record", async () => {
      const patientId = await createTestPatient();

      const res = await request(app)
        .post("/clinical-data")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          patientId,
          metrics: validMetrics,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        clinicalId: expect.any(String),
        patientId,
        metrics: expect.objectContaining({
          age: validMetrics.age,
          bloodPressure: validMetrics.bloodPressure,
        }),
      });
      expect(res.body.createdAt).toBeDefined();

      // Track for cleanup
      createdClinicalDataIds.push(res.body.clinicalId);

      // Verify the record was persisted in DB
      const dbRecord = await prisma.clinicalData.findUnique({
        where: { clinicalId: res.body.clinicalId },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord!.patientId).toBe(patientId);
    });
  });

  // -------------------------------------------------------------------------
  // POST /clinical-data — missing metric fields → HTTP 422 (Property 8)
  // -------------------------------------------------------------------------

  describe("POST /clinical-data — missing metric fields (Property 8)", () => {
    it("returns HTTP 422 when metrics object is entirely missing", async () => {
      const patientId = await createTestPatient();

      const res = await request(app)
        .post("/clinical-data")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          patientId,
          // metrics is missing
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
      });
      expect(res.body.error.fields).toBeDefined();
    });

    it("returns HTTP 422 when individual metric fields are missing", async () => {
      const patientId = await createTestPatient();

      const res = await request(app)
        .post("/clinical-data")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          patientId,
          metrics: {
            // age is missing
            bloodPressure: 120,
            // glucoseLevel is missing
            bmi: 24.5,
            cholesterol: 190,
            smokingStatus: "NEVER",
          },
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
      });
      expect(res.body.error.fields).toBeDefined();
    });

    it("does not create any DB record when validation fails", async () => {
      const patientId = await createTestPatient();

      const countBefore = await prisma.clinicalData.count({
        where: { patientId },
      });

      await request(app)
        .post("/clinical-data")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          patientId,
          metrics: {
            // all metric fields missing
          },
        });

      const countAfter = await prisma.clinicalData.count({
        where: { patientId },
      });

      expect(countAfter).toBe(countBefore);
    });
  });

  // -------------------------------------------------------------------------
  // POST /clinical-data — non-existent patientId → HTTP 404
  // -------------------------------------------------------------------------

  describe("POST /clinical-data — non-existent patientId", () => {
    it("returns HTTP 404 when the referenced patient does not exist", async () => {
      const nonExistentPatientId = "00000000-0000-0000-0000-000000000000";

      const res = await request(app)
        .post("/clinical-data")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          patientId: nonExistentPatientId,
          metrics: validMetrics,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  // -------------------------------------------------------------------------
  // POST /clinical-data — unauthenticated → HTTP 401
  // -------------------------------------------------------------------------

  describe("POST /clinical-data — authentication required", () => {
    it("returns HTTP 401 when no token is provided", async () => {
      const res = await request(app)
        .post("/clinical-data")
        .send({
          patientId: "00000000-0000-0000-0000-000000000001",
          metrics: validMetrics,
        });

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // POST /clinical-data — wrong role → HTTP 403
  // -------------------------------------------------------------------------

  describe("POST /clinical-data — RBAC enforcement", () => {
    it("returns HTTP 403 when a PATIENT role attempts to upload clinical data", async () => {
      const patientToken = jwt.sign(
        { userId: "test-patient-id", role: "PATIENT" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "1h" },
      );

      const res = await request(app)
        .post("/clinical-data")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          patientId: "00000000-0000-0000-0000-000000000001",
          metrics: validMetrics,
        });

      expect(res.status).toBe(403);
    });
  });
});
