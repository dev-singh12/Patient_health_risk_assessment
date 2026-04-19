/**
 * Integration tests — Auth and RBAC
 *
 * Tests the full API-to-database flow for:
 *   - POST /auth/login
 *   - POST /auth/refresh
 *   - POST /auth/logout
 *   - RBAC enforcement across protected endpoints
 *   - X-Correlation-ID header presence (Property 12)
 *
 * Requires a real PostgreSQL database. Tests are skipped when DATABASE_URL
 * is not set in the environment.
 *
 * Validates: Requirements 13.3, 1.1–1.7, 2.1–2.6
 * Property 5: RBAC Enforcement
 * Property 12: Correlation ID Present in Every Response
 */

import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import app from "../../app";
import { prisma } from "../../config/db";

// ---------------------------------------------------------------------------
// Skip guard — skip the entire suite when no test DB is available
// ---------------------------------------------------------------------------

const TEST_DB_URL = process.env.DATABASE_URL;
const skipIfNoDb = TEST_DB_URL ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

skipIfNoDb("Auth and RBAC — integration", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
    }
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  // Helper: create a user directly in DB
  // -------------------------------------------------------------------------

  async function createUser(
    email: string,
    password: string,
    role: "HEALTHCARE_STAFF" | "PATIENT" = "PATIENT",
  ): Promise<string> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: "Test User",
        email,
        password: hashedPassword,
        role,
      },
    });
    createdUserIds.push(user.userId);
    return user.userId;
  }

  // -------------------------------------------------------------------------
  // Full login → refresh → logout flow
  // -------------------------------------------------------------------------

  describe("Full login → refresh → logout flow", () => {
    it("completes the full auth lifecycle", async () => {
      const email = `test-auth-${Date.now()}@example.com`;
      const password = "SecurePass1!";
      await createUser(email, password);

      // Login
      const loginRes = await request(app)
        .post("/auth/login")
        .send({ email, password });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: expect.objectContaining({
          userId: expect.any(String),
        }),
      });

      const { refreshToken } = loginRes.body;

      // Refresh
      const refreshRes = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.refreshToken).toBeDefined();
      expect(refreshRes.body.refreshToken).not.toBe(refreshToken);

      const newRefreshToken = refreshRes.body.refreshToken;

      // Logout
      const logoutRes = await request(app)
        .post("/auth/logout")
        .send({ refreshToken: newRefreshToken });

      expect(logoutRes.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Refresh token reuse detection invalidates entire family
  // -------------------------------------------------------------------------

  describe("Refresh token reuse detection", () => {
    it("invalidates entire token family when a used refresh token is reused", async () => {
      const email = `test-reuse-${Date.now()}@example.com`;
      const password = "SecurePass1!";
      await createUser(email, password);

      // Login to get initial token pair
      const loginRes = await request(app)
        .post("/auth/login")
        .send({ email, password });

      expect(loginRes.status).toBe(200);
      const originalRefreshToken = loginRes.body.refreshToken;

      // Use the refresh token once (valid rotation)
      const firstRefresh = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: originalRefreshToken });

      expect(firstRefresh.status).toBe(200);

      // Attempt to reuse the original (already-used) refresh token
      const reuseRes = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: originalRefreshToken });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe("AUTHENTICATION_ERROR");

      // The new token from the first refresh should also be invalidated
      const newToken = firstRefresh.body.refreshToken;
      const afterInvalidation = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: newToken });

      expect(afterInvalidation.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // Brute-force lockout after 5 failed attempts
  // -------------------------------------------------------------------------

  describe("Brute-force lockout", () => {
    it("blocks login after 5 consecutive failed attempts", async () => {
      const email = `test-brute-${Date.now()}@example.com`;
      const password = "CorrectPass1!";
      await createUser(email, password);

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/auth/login")
          .set("X-Forwarded-For", "192.168.99.99")
          .send({ email, password: "WrongPassword!" });
      }

      // 6th attempt should be blocked (even with correct password)
      const blockedRes = await request(app)
        .post("/auth/login")
        .set("X-Forwarded-For", "192.168.99.99")
        .send({ email, password });

      // Should be blocked (401) due to brute-force protection
      expect(blockedRes.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // RBAC enforcement (Property 5)
  // -------------------------------------------------------------------------

  describe("RBAC enforcement (Property 5)", () => {
    it("returns HTTP 401 when no JWT is provided to a protected endpoint", async () => {
      const res = await request(app).post("/patients").send({
        name: "Test",
        email: "test@example.com",
        password: "pass12345",
        age: 30,
        medicalHistory: "None",
      });

      expect(res.status).toBe(401);
    });

    it("returns HTTP 403 when PATIENT role accesses HEALTHCARE_STAFF endpoint", async () => {
      const patientToken = jwt.sign(
        { userId: "test-patient-id", role: "PATIENT" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "1h" },
      );

      const res = await request(app)
        .post("/patients")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({
          name: "Test",
          email: `test-rbac-${Date.now()}@example.com`,
          password: "pass12345",
          age: 30,
          medicalHistory: "None",
        });

      expect(res.status).toBe(403);
    });

    it("returns HTTP 403 when PATIENT accesses another patient's data", async () => {
      const patientToken = jwt.sign(
        { userId: "patient-a-id", role: "PATIENT" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "1h" },
      );

      // Try to access a different patient's reports
      const res = await request(app)
        .get("/reports/different-patient-id")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
    });

    it("returns HTTP 401 when JWT is expired", async () => {
      const expiredToken = jwt.sign(
        { userId: "test-id", role: "HEALTHCARE_STAFF" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "-1s" }, // already expired
      );

      const res = await request(app)
        .post("/patients")
        .set("Authorization", `Bearer ${expiredToken}`)
        .send({
          name: "Test",
          email: `test-expired-${Date.now()}@example.com`,
          password: "pass12345",
          age: 30,
          medicalHistory: "None",
        });

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // X-Correlation-ID header present in all responses (Property 12)
  // -------------------------------------------------------------------------

  describe("X-Correlation-ID header (Property 12)", () => {
    const endpoints = [
      { method: "post" as const, path: "/auth/login", body: { email: "x@x.com", password: "pass12345" } },
      { method: "post" as const, path: "/auth/refresh", body: { refreshToken: "invalid" } },
      { method: "post" as const, path: "/patients", body: {} },
      { method: "get" as const, path: "/patients/nonexistent", body: undefined },
      { method: "post" as const, path: "/clinical-data", body: {} },
      { method: "post" as const, path: "/assessment/run", body: {} },
      { method: "get" as const, path: "/assessments/nonexistent", body: undefined },
      { method: "get" as const, path: "/reports/nonexistent", body: undefined },
    ];

    endpoints.forEach(({ method, path, body }) => {
      it(`includes X-Correlation-ID header in response for ${method.toUpperCase()} ${path}`, async () => {
        const req = request(app)[method](path);
        if (body !== undefined) {
          req.send(body);
        }

        const res = await req;

        expect(res.headers["x-correlation-id"]).toBeDefined();
        expect(typeof res.headers["x-correlation-id"]).toBe("string");
        expect(res.headers["x-correlation-id"].length).toBeGreaterThan(0);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Invalid credentials → HTTP 401 (generic message)
  // -------------------------------------------------------------------------

  describe("Login with invalid credentials", () => {
    it("returns HTTP 401 with generic error message for wrong password", async () => {
      const email = `test-invalid-${Date.now()}@example.com`;
      await createUser(email, "CorrectPass1!");

      const res = await request(app)
        .post("/auth/login")
        .send({ email, password: "WrongPassword!" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("AUTHENTICATION_ERROR");
      // Should not reveal which field is wrong
      expect(res.body.error.message).not.toContain("email");
      expect(res.body.error.message).not.toContain("password");
    });

    it("returns HTTP 401 for non-existent email", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "nonexistent@example.com", password: "SomePass1!" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("AUTHENTICATION_ERROR");
    });
  });
});
