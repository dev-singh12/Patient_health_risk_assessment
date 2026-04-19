/**
 * End-to-end test — Healthcare Staff Journey
 *
 * Covers the complete workflow:
 *   1. Healthcare staff logs in
 *   2. Adds a new patient
 *   3. Uploads clinical data for the patient
 *   4. Triggers a health risk assessment
 *   5. Views the generated health report
 *
 * Validates: Requirements 13.4, 1.1, 3.1, 4.1, 5.1, 7.5
 */

const BASE_URL = Cypress.env("API_URL") || "http://localhost:3000";

describe("Healthcare Staff Journey", () => {
  let accessToken: string;
  let patientId: string;
  let jobId: string;

  const staffCredentials = {
    email: "staff1@hospital.com",
    password: "Staff@123",
  };

  const newPatient = {
    name: "E2E Test Patient",
    email: `e2e-patient-${Date.now()}@example.com`,
    password: "Patient@123",
    age: 45,
    medicalHistory: "Hypertension, mild diabetes",
  };

  const clinicalMetrics = {
    age: 45,
    bloodPressure: 135,
    glucoseLevel: 115,
    bmi: 28,
    cholesterol: 215,
    smokingStatus: "FORMER",
  };

  // -------------------------------------------------------------------------
  // Step 1: Login
  // -------------------------------------------------------------------------

  it("1. Healthcare staff logs in successfully", () => {
    cy.request({
      method: "POST",
      url: `${BASE_URL}/auth/login`,
      body: staffCredentials,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("accessToken");
      expect(response.body).to.have.property("refreshToken");
      expect(response.body.user.role).to.eq("HEALTHCARE_STAFF");

      accessToken = response.body.accessToken;

      // Verify X-Correlation-ID header is present
      expect(response.headers).to.have.property("x-correlation-id");
    });
  });

  // -------------------------------------------------------------------------
  // Step 2: Add a new patient
  // -------------------------------------------------------------------------

  it("2. Healthcare staff adds a new patient", () => {
    cy.request({
      method: "POST",
      url: `${BASE_URL}/patients`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: newPatient,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body).to.have.property("patientId");
      expect(response.body).to.have.property("userId");
      expect(response.body.age).to.eq(newPatient.age);
      expect(response.body.medicalHistory).to.eq(newPatient.medicalHistory);

      patientId = response.body.patientId;

      // Verify X-Correlation-ID header
      expect(response.headers).to.have.property("x-correlation-id");
    });
  });

  // -------------------------------------------------------------------------
  // Step 3: Upload clinical data
  // -------------------------------------------------------------------------

  it("3. Healthcare staff uploads clinical data for the patient", () => {
    cy.request({
      method: "POST",
      url: `${BASE_URL}/clinical-data`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        patientId,
        metrics: clinicalMetrics,
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body).to.have.property("clinicalId");
      expect(response.body.patientId).to.eq(patientId);
      expect(response.body.metrics).to.deep.include({
        age: clinicalMetrics.age,
        bloodPressure: clinicalMetrics.bloodPressure,
      });

      // Verify X-Correlation-ID header
      expect(response.headers).to.have.property("x-correlation-id");
    });
  });

  // -------------------------------------------------------------------------
  // Step 4: Trigger assessment
  // -------------------------------------------------------------------------

  it("4. Healthcare staff triggers a health risk assessment", () => {
    const idempotencyKey = `e2e-test-${Date.now()}`;

    cy.request({
      method: "POST",
      url: `${BASE_URL}/assessment/run`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        patientId,
        idempotencyKey,
      },
      failOnStatusCode: false,
    }).then((response) => {
      // Should return 202 (job enqueued) or 200 (cached result)
      expect([200, 202]).to.include(response.status);

      if (response.status === 202) {
        expect(response.body).to.have.property("jobId");
        jobId = response.body.jobId;
      }

      // Verify X-Correlation-ID header
      expect(response.headers).to.have.property("x-correlation-id");
    });
  });

  // -------------------------------------------------------------------------
  // Step 5: View assessments list
  // -------------------------------------------------------------------------

  it("5. Healthcare staff views the assessments list for the patient", () => {
    cy.request({
      method: "GET",
      url: `${BASE_URL}/assessments/${patientId}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.be.an("array");

      // Verify X-Correlation-ID header
      expect(response.headers).to.have.property("x-correlation-id");
    });
  });

  // -------------------------------------------------------------------------
  // Step 6: View health reports
  // -------------------------------------------------------------------------

  it("6. Healthcare staff views health reports for the patient", () => {
    cy.request({
      method: "GET",
      url: `${BASE_URL}/reports/${patientId}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.be.an("array");

      // Verify X-Correlation-ID header
      expect(response.headers).to.have.property("x-correlation-id");
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup: logout
  // -------------------------------------------------------------------------

  after(() => {
    if (accessToken) {
      cy.request({
        method: "POST",
        url: `${BASE_URL}/auth/logout`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: { refreshToken: "cleanup" },
        failOnStatusCode: false,
      });
    }
  });
});
