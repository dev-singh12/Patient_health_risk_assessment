import type Redis from "ioredis";
import type pino from "pino";
import { sql } from "drizzle-orm";
import { db } from "../../config/db";
import { ConflictError, PipelineError, ValidationError } from "../../errors";
import type { IAssessmentRepository } from "../../repositories/assessment.repository";
import type { IClinicalDataRepository } from "../../repositories/clinicalData.repository";
import type { IReportRepository } from "../../repositories/report.repository";
import type { RiskService } from "../domain/risk.service";
import type { ReportService } from "../domain/report.service";
import type { RecommendationService } from "../domain/recommendation.service";
import type { AssessmentResultDto } from "../../dtos/assessment.dto";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IHealthAssessmentOrchestrator {
  runAssessment(
    patientId: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<AssessmentResultDto>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic hash of a patient ID string to a BigInt for pg advisory lock. */
function hashPatientId(patientId: string): bigint {
  let hash = 0n;
  for (let i = 0; i < patientId.length; i++) {
    hash = (hash * 31n + BigInt(patientId.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  return hash & 0x7fffffffffffffffn;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class HealthAssessmentOrchestrator implements IHealthAssessmentOrchestrator {
  constructor(
    private readonly riskService: RiskService,
    private readonly reportService: ReportService,
    private readonly recommendationService: RecommendationService,
    private readonly clinicalDataRepo: IClinicalDataRepository,
    private readonly assessmentRepo: IAssessmentRepository,
    private readonly reportRepo: IReportRepository,
    private readonly redisClient: Redis,
    private readonly log: pino.Logger,
  ) {}

  async runAssessment(
    patientId: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<AssessmentResultDto> {
    const startTime = Date.now();
    const idempotencyRedisKey = `idempotency:${idempotencyKey}`;

    // ── 1. Idempotency check ────────────────────────────────────────────────
    const existingRaw = await this.redisClient.get(idempotencyRedisKey).catch(() => null);
    if (existingRaw) {
      let existing: { status: string; result?: AssessmentResultDto };
      try { existing = JSON.parse(existingRaw); } catch { existing = { status: existingRaw }; }

      if (existing.status === "in_flight") {
        throw new ConflictError("A duplicate in-flight request is already being processed.");
      }
      if (existing.status === "complete" && existing.result) {
        return existing.result;
      }
    }

    await this.redisClient
      .set(idempotencyRedisKey, JSON.stringify({ status: "in_flight" }), "EX", 600)
      .catch(() => {});

    // ── 2. DB transaction ───────────────────────────────────────────────────
    let stageName = "acquire_lock";
    let result: AssessmentResultDto;

    try {
      result = await db.transaction(async (tx) => {
        // Advisory lock
        const lockKey = hashPatientId(patientId);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`);

        stageName = "validate_input";
        this.log.info({ stage: stageName, correlationId, patientId, elapsedMs: Date.now() - startTime });

        const clinicalData = await this.clinicalDataRepo.findLatestByPatientId(patientId, tx);
        if (!clinicalData) {
          throw new ValidationError("No clinical data available for assessment");
        }

        stageName = "invoke_risk_engine";
        this.log.info({ stage: stageName, correlationId, patientId, elapsedMs: Date.now() - startTime });

        const { riskScore, riskLevel } = this.riskService.calculateRisk(clinicalData.metrics);

        stageName = "create_assessment_record";
        this.log.info({ stage: stageName, correlationId, patientId, elapsedMs: Date.now() - startTime });

        const assessment = await this.assessmentRepo.create(
          { patientId, riskScore, riskLevel, status: "PROCESSING" },
          tx,
        );

        stageName = "generate_report";
        this.log.info({ stage: stageName, correlationId, patientId, elapsedMs: Date.now() - startTime });

        const summary = this.reportService.buildSummary(riskScore, riskLevel);

        stageName = "fetch_recommendations";
        this.log.info({ stage: stageName, correlationId, patientId, elapsedMs: Date.now() - startTime });

        const recommendations = await this.recommendationService.getRecommendations(riskLevel, correlationId);

        stageName = "persist_report";
        this.log.info({ stage: stageName, correlationId, patientId, elapsedMs: Date.now() - startTime });

        const report = await this.reportRepo.create(
          { assessmentId: assessment.assessmentId, summary, recommendations },
          tx,
        );

        await this.assessmentRepo.updateStatus(assessment.assessmentId, "COMPLETED", tx);

        return {
          assessmentId: assessment.assessmentId,
          patientId: assessment.patientId,
          riskScore: assessment.riskScore,
          riskLevel: assessment.riskLevel,
          status: "COMPLETED" as const,
          report: {
            reportId: report.reportId,
            summary: report.summary,
            recommendations: report.recommendations,
            version: report.version,
          },
        };
      });
    } catch (err) {
      await this.redisClient
        .set(idempotencyRedisKey, JSON.stringify({ status: "failed" }), "EX", 600)
        .catch(() => {});

      this.log.error({
        stage: stageName, correlationId, patientId,
        elapsedMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
      });

      if (err instanceof ValidationError || err instanceof ConflictError) throw err;
      throw new PipelineError(stageName, correlationId, err instanceof Error ? err : undefined);
    }

    // ── 3–6. Post-transaction ───────────────────────────────────────────────
    await this.redisClient
      .set(idempotencyRedisKey, JSON.stringify({ status: "complete", result }), "EX", 86400)
      .catch(() => {});

    await Promise.all([
      this.redisClient.del(`reports:${patientId}`).catch(() => {}),
      this.redisClient.del(`assessments:${patientId}`).catch(() => {}),
    ]);

    this.log.info({ stage: "pipeline_complete", correlationId, patientId, elapsedMs: Date.now() - startTime });

    return result;
  }
}
