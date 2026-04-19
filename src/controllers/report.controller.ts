import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { auditLog } from "../middleware/auditLog.middleware";
import { ReportRepository } from "../repositories/report.repository";
import { redis } from "../config/redis";
import { AuthorizationError } from "../errors";
import { logger } from "../config/logger";
import { parsePagination, buildPaginatedResponse } from "../utils/pagination";

const reportRepo = new ReportRepository();
const CACHE_TTL_SECONDS = 300;

export const reportRouter = Router();

/**
 * GET /api/v1/reports/:patientId
 *
 * Returns paginated health reports for a patient, ordered by createdAt desc.
 * Query params: page, limit, sortOrder (asc|desc)
 */
reportRouter.get(
  "/:patientId",
  authMiddleware,
  auditLog("READ_REPORTS"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId } = req.params;
      const requestingUser = req.user!;
      const correlationId = req.correlationId;

      if (requestingUser.role === "PATIENT" && requestingUser.userId !== patientId) {
        throw new AuthorizationError("Insufficient permissions");
      }

      const pagination = parsePagination(req.query as Record<string, unknown>);
      const cacheKey = `reports:${patientId}:p${pagination.page}:l${pagination.limit}:s${pagination.sortOrder}`;

      let cached: unknown = null;
      try {
        const raw = await redis.get(cacheKey);
        if (raw) cached = JSON.parse(raw);
      } catch {
        logger.warn({ correlationId, patientId }, "Redis unavailable for reports cache");
      }

      if (cached) {
        res.status(200).json(cached);
        return;
      }

      const { rows, total } = await reportRepo.findAllByPatientId(patientId, {
        page: pagination.page,
        limit: pagination.limit,
        sortOrder: pagination.sortOrder,
      });

      const response = buildPaginatedResponse(
        rows.map(r => ({
          reportId:        r.reportId,
          assessmentId:    r.assessmentId,
          summary:         r.summary,
          recommendations: r.recommendations,
          version:         r.version,
          createdAt:       r.createdAt,
          updatedAt:       r.updatedAt,
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
