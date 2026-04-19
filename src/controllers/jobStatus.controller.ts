import { Router, Request, Response, NextFunction } from "express";
import { assessmentQueue } from "../config/bullmq";
import { redis } from "../config/redis";
import { authMiddleware } from "../middleware/auth.middleware";
import { NotFoundError } from "../errors";

export const jobStatusRouter = Router();

/**
 * GET /jobs/:jobId
 * Returns the current status of an assessment job.
 * Also checks the idempotency cache for completed results.
 */
jobStatusRouter.get(
  "/:jobId",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;

      const job = await assessmentQueue.getJob(jobId);
      if (!job) throw new NotFoundError("Job");

      const state = await job.getState();
      const progress = job.progress;

      // Check if there's a completed result in the idempotency cache
      let result: unknown = null;
      if (state === "completed") {
        const idempotencyKey = (job.data as { idempotencyKey?: string }).idempotencyKey;
        if (idempotencyKey) {
          const cached = await redis.get(`idempotency:${idempotencyKey}`).catch(() => null);
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (parsed.status === "complete") result = parsed.result;
            } catch { /* ignore */ }
          }
        }
      }

      res.status(200).json({
        jobId,
        state,
        progress,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason ?? null,
        createdAt: new Date(job.timestamp).toISOString(),
        processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        result,
      });
    } catch (err) {
      next(err);
    }
  },
);
