import { Router, Request, Response, NextFunction } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbac } from "../middleware/rbac.middleware";
import { validate } from "../middleware/validate.middleware";
import { auditLog } from "../middleware/auditLog.middleware";
import { RunAssessmentSchema } from "../dtos/assessment.dto";
import { enqueueAssessment } from "../jobs/assessment.job";
import { AssessmentRepository } from "../repositories/assessment.repository";
import { redis } from "../config/redis";
import { AuthorizationError } from "../errors";
import { logger } from "../config/logger";
import { parsePagination, buildPaginatedResponse } from "../utils/pagination";
import { db } from "../config/db";
import { patients } from "../db/schema";
import type { AssessmentStatus } from "../models/domain.types";

const assessmentRepo = new AssessmentRepository();
const CACHE_TTL_SECONDS = 300;

export const assessmentRunRouter = Router();
export const assessmentListRouter = Router();

/**
 * POST /api/v1/assessment/run
 *
 * Enqueues (or synchronously runs) an assessment pipeline.
 * Query param: ?async=false runs synchronously via the orchestrator (default: true = async via BullMQ).
 *
 * Idempotency: if the key maps to a completed result, returns HTTP 200 immediately.
 */
assessmentRunRouter.post(
  "/run",
  authMiddleware,
  rbac("HEALTHCARE_STAFF"),
  validate(RunAssessmentSchema),
  auditLog("TRIGGER_ASSESSMENT"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId, idempotencyKey } = req.body;
      const correlationId = req.correlationId;

      // Idempotency check
      const idempotencyRedisKey = `idempotency:${idempotencyKey}`;
      let cachedRaw: string | null = null;
      try {
        cachedRaw = await redis.get(idempotencyRedisKey);
      } catch {
        logger.warn({ correlationId }, "Redis unavailable for idempotency check");
      }

      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw);
          if (cached.status === "complete" && cached.result) {
            res.status(200).json({ source: "cache", ...cached.result });
            return;
          }
          if (cached.status === "in_flight") {
            res.status(202).json({ message: "Assessment already in progress", idempotencyKey });
            return;
          }
        } catch { /* malformed — proceed */ }
      }

      // Enqueue async job (always async — sync mode removed for simplicity; use job status endpoint)
      const job = await enqueueAssessment({ patientId, idempotencyKey, correlationId });

      res.status(202).json({
        jobId: job.id,
        patientId,
        idempotencyKey,
        statusUrl: `/api/v1/jobs/${job.id}`,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/assessments/:patientId
 *
 * Returns paginated risk assessments for a patient.
 * Query params: page, limit, sortOrder (asc|desc), status (PROCESSING|COMPLETED|FAILED)
 */
assessmentListRouter.get(
  "/:patientId",
  authMiddleware,
  auditLog("READ_ASSESSMENTS"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId } = req.params;
      const requestingUser = req.user!;
      const correlationId = req.correlationId;

      if (requestingUser.role === "PATIENT") {
        // Look up the patient record for this user and verify ownership
        const [patientRecord] = await db
          .select({ patientId: patients.patientId })
          .from(patients)
          .where(and(eq(patients.userId, requestingUser.userId), isNull(patients.deletedAt)))
          .limit(1);
        if (!patientRecord || patientRecord.patientId !== patientId) {
          throw new AuthorizationError("Insufficient permissions");
        }
      }

      const pagination = parsePagination(req.query as Record<string, unknown>);
      const statusFilter = req.query.status as AssessmentStatus | undefined;

      // Cache key includes pagination params so different pages are cached separately
      const cacheKey = `assessments:${patientId}:p${pagination.page}:l${pagination.limit}:s${pagination.sortOrder}:f${statusFilter ?? "all"}`;
      let cached: unknown = null;

      try {
        const raw = await redis.get(cacheKey);
        if (raw) cached = JSON.parse(raw);
      } catch {
        logger.warn({ correlationId, patientId }, "Redis unavailable for assessments cache");
      }

      if (cached) {
        res.status(200).json(cached);
        return;
      }

      const { rows, total } = await assessmentRepo.findAllByPatientId(patientId, {
        page: pagination.page,
        limit: pagination.limit,
        sortOrder: pagination.sortOrder,
        status: statusFilter,
      });

      const response = buildPaginatedResponse(
        rows.map(a => ({
          assessmentId: a.assessmentId,
          patientId: a.patientId,
          riskScore: a.riskScore,
          riskLevel: a.riskLevel,
          status: a.status,
          createdAt: a.createdAt,
        })),
        total,
        pagination,
      );

      try {
        await redis.set(cacheKey, JSON.stringify(response), "EX", CACHE_TTL_SECONDS);
      } catch { /* non-critical */ }

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);
