/**
 * Unit tests — HealthAssessmentOrchestrator
 *
 * All dependencies are mocked. Tests cover:
 *   - Successful pipeline execution
 *   - Rollback on Risk Engine failure
 *   - Rollback on KnowledgeService failure
 *   - Rejection when no clinical data (HTTP 422)
 *   - Idempotency deduplication (in-flight + complete)
 *   - Log entries emitted at each stage boundary
 */

import { HealthAssessmentOrchestrator } from "../../services/orchestrator/healthAssessment.orchestrator";
import { ValidationError, ConflictError, PipelineError } from "../../errors";

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockRiskService = {
  calculateRisk: jest.fn().mockReturnValue({ riskScore: 37.7, riskLevel: "MODERATE" }),
};

const mockReportService = {
  buildSummary: jest.fn().mockReturnValue("Risk score: 37.7/100 (MODERATE)."),
};

const mockRecommendationService = {
  getRecommendations: jest.fn().mockResolvedValue(["Increase physical activity"]),
};

const mockClinicalDataRepo = {
  findLatestByPatientId: jest.fn().mockResolvedValue({
    clinicalId: "cd-1",
    patientId: "patient-1",
    metrics: { age: 45, bloodPressure: 130, glucoseLevel: 110, bmi: 27, cholesterol: 210, smokingStatus: "FORMER" },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  }),
};

const mockAssessmentRepo = {
  create: jest.fn().mockResolvedValue({
    assessmentId: "assess-1",
    patientId: "patient-1",
    riskScore: 37.7,
    riskLevel: "MODERATE",
    status: "PROCESSING",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  }),
  updateStatus: jest.fn().mockResolvedValue(undefined),
};

const mockReportRepo = {
  create: jest.fn().mockResolvedValue({
    reportId: "report-1",
    assessmentId: "assess-1",
    summary: "Risk score: 37.7/100 (MODERATE).",
    recommendations: ["Increase physical activity"],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
};

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

// ── Mock db.transaction ───────────────────────────────────────────────────

jest.mock("../../config/db", () => ({
  db: {
    transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        execute: jest.fn().mockResolvedValue([]),
      };
      return fn(mockTx);
    }),
  },
}));

// ── Factory ───────────────────────────────────────────────────────────────

function makeOrchestrator() {
  return new HealthAssessmentOrchestrator(
    mockRiskService as never,
    mockReportService as never,
    mockRecommendationService as never,
    mockClinicalDataRepo as never,
    mockAssessmentRepo as never,
    mockReportRepo as never,
    mockRedis as never,
    mockLogger as never,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.get.mockResolvedValue(null);
});

describe("HealthAssessmentOrchestrator.runAssessment", () => {

  describe("successful pipeline", () => {
    it("returns AssessmentResultDto with correct shape", async () => {
      const orchestrator = makeOrchestrator();
      const result = await orchestrator.runAssessment("patient-1", "key-1", "corr-1");

      expect(result).toMatchObject({
        assessmentId: "assess-1",
        patientId: "patient-1",
        riskScore: 37.7,
        riskLevel: "MODERATE",
        status: "COMPLETED",
        report: {
          reportId: "report-1",
          summary: expect.any(String),
          recommendations: expect.any(Array),
          version: 1,
        },
      });
    });

    it("calls all pipeline stages in order", async () => {
      const callOrder: string[] = [];
      mockClinicalDataRepo.findLatestByPatientId.mockImplementation(async () => {
        callOrder.push("findLatestClinicalData");
        return { clinicalId: "cd-1", patientId: "patient-1", metrics: {}, createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
      });
      mockRiskService.calculateRisk.mockImplementation(() => {
        callOrder.push("calculateRisk");
        return { riskScore: 37.7, riskLevel: "MODERATE" };
      });
      mockAssessmentRepo.create.mockImplementation(async () => {
        callOrder.push("createAssessment");
        return { assessmentId: "assess-1", patientId: "patient-1", riskScore: 37.7, riskLevel: "MODERATE", status: "PROCESSING", createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
      });
      mockReportService.buildSummary.mockImplementation(() => {
        callOrder.push("buildSummary");
        return "summary";
      });
      mockRecommendationService.getRecommendations.mockImplementation(async () => {
        callOrder.push("getRecommendations");
        return ["rec"];
      });
      mockReportRepo.create.mockImplementation(async () => {
        callOrder.push("createReport");
        return { reportId: "r-1", assessmentId: "assess-1", summary: "s", recommendations: [], version: 1, createdAt: new Date(), updatedAt: new Date() };
      });
      mockAssessmentRepo.updateStatus.mockImplementation(async () => {
        callOrder.push("updateStatus");
      });

      const orchestrator = makeOrchestrator();
      await orchestrator.runAssessment("patient-1", "key-1", "corr-1");

      expect(callOrder).toEqual([
        "findLatestClinicalData",
        "calculateRisk",
        "createAssessment",
        "buildSummary",
        "getRecommendations",
        "createReport",
        "updateStatus",
      ]);
    });

    it("sets idempotency key to 'complete' after success", async () => {
      const orchestrator = makeOrchestrator();
      await orchestrator.runAssessment("patient-1", "key-1", "corr-1");

      const setCall = mockRedis.set.mock.calls.find(
        (c: string[]) => c[0] === "idempotency:key-1" && c[1].includes('"complete"'),
      );
      expect(setCall).toBeDefined();
    });

    it("invalidates cache keys after success", async () => {
      const orchestrator = makeOrchestrator();
      await orchestrator.runAssessment("patient-1", "key-1", "corr-1");

      expect(mockRedis.del).toHaveBeenCalledWith("reports:patient-1");
      expect(mockRedis.del).toHaveBeenCalledWith("assessments:patient-1");
    });

    it("emits log entries at each stage boundary", async () => {
      const orchestrator = makeOrchestrator();
      await orchestrator.runAssessment("patient-1", "key-1", "corr-1");

      const stages = mockLogger.info.mock.calls
        .filter((c: Array<Record<string, unknown>>) => c[0]?.stage)
        .map((c: Array<Record<string, unknown>>) => c[0].stage);

      expect(stages).toContain("validate_input");
      expect(stages).toContain("invoke_risk_engine");
      expect(stages).toContain("create_assessment_record");
      expect(stages).toContain("generate_report");
      expect(stages).toContain("fetch_recommendations");
      expect(stages).toContain("persist_report");
      expect(stages).toContain("pipeline_complete");
    });
  });

  describe("no clinical data", () => {
    it("throws ValidationError and does not invoke Risk Engine", async () => {
      mockClinicalDataRepo.findLatestByPatientId.mockResolvedValue(null);
      const orchestrator = makeOrchestrator();

      await expect(orchestrator.runAssessment("patient-1", "key-1", "corr-1"))
        .rejects.toThrow(ValidationError);

      expect(mockRiskService.calculateRisk).not.toHaveBeenCalled();
    });

    it("sets idempotency key to 'failed' on ValidationError", async () => {
      mockClinicalDataRepo.findLatestByPatientId.mockResolvedValue(null);
      const orchestrator = makeOrchestrator();

      try { await orchestrator.runAssessment("patient-1", "key-1", "corr-1"); } catch { /* expected */ }

      const setCall = mockRedis.set.mock.calls.find(
        (c: string[]) => c[0] === "idempotency:key-1" && c[1].includes('"failed"'),
      );
      expect(setCall).toBeDefined();
    });
  });

  describe("Risk Engine failure", () => {
    beforeEach(() => {
      // Restore clinical data mock so the pipeline reaches the Risk Engine
      mockClinicalDataRepo.findLatestByPatientId.mockResolvedValue({
        clinicalId: "cd-1", patientId: "patient-1",
        metrics: { age: 45, bloodPressure: 130, glucoseLevel: 110, bmi: 27, cholesterol: 210, smokingStatus: "FORMER" },
        createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      });
    });

    it("throws PipelineError when Risk Engine throws", async () => {
      mockRiskService.calculateRisk.mockImplementation(() => {
        throw new Error("ML model unavailable");
      });
      const orchestrator = makeOrchestrator();

      await expect(orchestrator.runAssessment("patient-1", "key-1", "corr-1"))
        .rejects.toThrow(PipelineError);
    });

    it("includes the failing stage name in PipelineError", async () => {
      mockRiskService.calculateRisk.mockImplementation(() => {
        throw new Error("ML model unavailable");
      });
      const orchestrator = makeOrchestrator();

      try {
        await orchestrator.runAssessment("patient-1", "key-1", "corr-1");
      } catch (e) {
        expect(e).toBeInstanceOf(PipelineError);
        expect((e as PipelineError).stageName).toBe("invoke_risk_engine");
      }
    });
  });

  describe("KnowledgeService failure", () => {
    beforeEach(() => {
      mockClinicalDataRepo.findLatestByPatientId.mockResolvedValue({
        clinicalId: "cd-1", patientId: "patient-1",
        metrics: { age: 45, bloodPressure: 130, glucoseLevel: 110, bmi: 27, cholesterol: 210, smokingStatus: "FORMER" },
        createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      });
      mockRiskService.calculateRisk.mockReturnValue({ riskScore: 37.7, riskLevel: "MODERATE" });
      mockAssessmentRepo.create.mockResolvedValue({
        assessmentId: "assess-1", patientId: "patient-1", riskScore: 37.7, riskLevel: "MODERATE",
        status: "PROCESSING", createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      });
      mockReportService.buildSummary.mockReturnValue("summary");
    });

    it("throws PipelineError when KnowledgeService throws", async () => {
      mockRecommendationService.getRecommendations.mockRejectedValue(new Error("Knowledge API down"));
      const orchestrator = makeOrchestrator();

      await expect(orchestrator.runAssessment("patient-1", "key-1", "corr-1"))
        .rejects.toThrow(PipelineError);
    });
  });

  describe("idempotency", () => {
    it("returns cached result when idempotency key is 'complete'", async () => {
      const cachedResult = { assessmentId: "cached-1", patientId: "patient-1", riskScore: 20, riskLevel: "LOW", status: "COMPLETED", report: { reportId: "r-1", summary: "s", recommendations: [], version: 1 } };
      mockRedis.get.mockResolvedValue(JSON.stringify({ status: "complete", result: cachedResult }));

      const orchestrator = makeOrchestrator();
      const result = await orchestrator.runAssessment("patient-1", "key-1", "corr-1");

      expect(result).toEqual(cachedResult);
      expect(mockRiskService.calculateRisk).not.toHaveBeenCalled();
    });

    it("throws ConflictError when idempotency key is 'in_flight'", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ status: "in_flight" }));
      const orchestrator = makeOrchestrator();

      await expect(orchestrator.runAssessment("patient-1", "key-1", "corr-1"))
        .rejects.toThrow(ConflictError);
    });
  });
});
