/**
 * Integration tests — Patient endpoints
 *
 * Tests the full API-to-database flow for:
 *   - POST /patients  (create patient)
 *   - GET  /patients/:id
 *
 * Requires a real PostgreSQL database. Tests are skipped when DATABASE_URL
 * is not set in the environment.
 *
 * Validates: Requirements 13.3, 3.1, 3.2, 3.5
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
// Test suite
// ---------------------------------------------------------------------------

skipIfNoDb("POST /patients and GET /patients/:id — integration", () => {
  let staffToken: string;

  // Track created records for cleanup
  const createdPatientIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    staffToken = await getStaffToken();
  });

  afterAll(async () => {
    // Clean up in reverse FK order: patients → users
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
  // POST /patients — success
  // -------------------------------------------------------------------------

  describe("POST /patients — success", () => {
    it("returns HTTP 201 and creates both users and patients DB records", async () => {
      const email = `test-patient-${Date.now()}@example.com`;

      const res = await request(app)
        .post("/patients")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          name: "Alice Test",
          email,
          password: "SecurePass1!",
          age: 35,
          medicalHistory: "No known allergies",
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        patientId: expect.any(String),
        userId: expect.any(String),
        age: 35,
        medicalHistory: "No known allergies",
      });

      const { patientId, userId } = res.body;

      // Track for cleanup
      createdPatientIds.push(patientId);
      createdUserIds.push(userId);

      // Verify users record was created in DB
      const userRecord = await prisma.user.findUnique({
        where: { userId },
      });
      expect(userRecord).not.toBeNull();
      expect(userRecord!.email).toBe(email);
      expect(userRecord!.role).toBe("PATIENT");

      // Verify patients record was created in DB
      const patientRecord = await prisma.patient.findUnique({
        where: { patientId },
      });
      expect(patientRecord).not.toBeNull();
      expect(patientRecord!.userId).toBe(userId);
      expect(patientRecord!.age).toBe(35);
    });
  });

  // -------------------------------------------------------------------------
  // POST /patients — duplicate email → HTTP 409
  // -------------------------------------------------------------------------

  describe("POST /patients — duplicate email", () => {
    it("returns HTTP 409 and creates no records when email already exists", async () => {
      const email = `test-dup-${Date.now()}@example.com`;

      // First registration — should succeed
      const first = await request(app)
        .post("/patients")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          name: "Bob Test",
          email,
          password: "SecurePass1!",
          age: 40,
          medicalHistory: "Hypertension",
        });

      expect(first.status).toBe(201);
      createdPatientIds.push(first.body.patientId);
      createdUserIds.push(first.body.userId);

      // Count records before duplicate attempt
      const userCountBefore = await prisma.user.count({
        where: { email },
      });

      // Second registration with same email — should conflict
      const second = await request(app)
        .post("/patients")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          name: "Bob Duplicate",
          email,
          password: "AnotherPass1!",
          age: 41,
          medicalHistory: "Diabetes",
        });

      expect(second.status).toBe(409);
      expect(second.body.error).toMatchObject({
        code: "CONFLICT",
      });

      // Verify no additional records were created
      const userCountAfter = await prisma.user.count({
        where: { email },
      });
      expect(userCountAfter).toBe(userCountBefore);
    });
  });

  // -------------------------------------------------------------------------
  // GET /patients/:id — returns patient DTO
  // -------------------------------------------------------------------------

  describe("GET /patients/:id — success", () => {
    it("returns HTTP 200 with the patient DTO", async () => {
      const email = `test-get-${Date.now()}@example.com`;

      // Create a patient first
      const createRes = await request(app)
        .post("/patients")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          name: "Carol Test",
          email,
          password: "SecurePass1!",
          age: 28,
          medicalHistory: "Asthma",
        });

      expect(createRes.status).toBe(201);
      const { patientId, userId } = createRes.body;
      createdPatientIds.push(patientId);
      createdUserIds.push(userId);

      // Fetch the patient
      const getRes = await request(app)
        .get(`/patients/${patientId}`)
        .set("Authorization", `Bearer ${staffToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body).toMatchObject({
        patientId,
        userId,
        age: 28,
        medicalHistory: "Asthma",
      });
      expect(getRes.body.createdAt).toBeDefined();
      expect(getRes.body.updatedAt).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // GET /patients/:id — soft-deleted patient → HTTP 404
  // -------------------------------------------------------------------------

  describe("GET /patients/:id — soft-deleted patient", () => {
    it("returns HTTP 404 for a soft-deleted patient", async () => {
      const email = `test-softdel-${Date.now()}@example.com`;

      // Create a patient
      const createRes = await request(app)
        .post("/patients")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          name: "Dave Test",
          email,
          password: "SecurePass1!",
          age: 50,
          medicalHistory: "Diabetes",
        });

      expect(createRes.status).toBe(201);
      const { patientId, userId } = createRes.body;
      createdUserIds.push(userId);

      // Soft-delete the patient directly via DB
      await prisma.patient.update({
        where: { patientId },
        data: { deletedAt: new Date() },
      });

      // Attempt to fetch the soft-deleted patient
      const getRes = await request(app)
        .get(`/patients/${patientId}`)
        .set("Authorization", `Bearer ${staffToken}`);

      expect(getRes.status).toBe(404);
      expect(getRes.body.error).toMatchObject({
        code: "NOT_FOUND",
      });

      // Hard-delete the patient record for cleanup
      await prisma.patient.delete({ where: { patientId } });
    });
  });

  // -------------------------------------------------------------------------
  // POST /patients — missing required fields → HTTP 422
  // -------------------------------------------------------------------------

  describe("POST /patients — missing required fields", () => {
    it("returns HTTP 422 with field-level errors when required fields are absent", async () => {
      const res = await request(app)
        .post("/patients")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          // name is missing
          email: `test-missing-${Date.now()}@example.com`,
          // password is missing
          age: 30,
          // medicalHistory is missing
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        fields: expect.objectContaining({
          name: expect.any(String),
          password: expect.any(String),
          medicalHistory: expect.any(String),
        }),
      });
    });

    it("returns HTTP 422 when all required fields are missing", async () => {
      const res = await request(app)
        .post("/patients")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.fields).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // POST /patients — unauthenticated → HTTP 401
  // -------------------------------------------------------------------------

  describe("POST /patients — authentication required", () => {
    it("returns HTTP 401 when no token is provided", async () => {
      const res = await request(app)
        .post("/patients")
        .send({
          name: "No Auth User",
          email: `test-noauth-${Date.now()}@example.com`,
          password: "SecurePass1!",
          age: 25,
          medicalHistory: "None",
        });

      expect(res.status).toBe(401);
    });
  });
});
