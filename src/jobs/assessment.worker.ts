import { Worker } from "bullmq";
import { redis } from "../config/redis";
import { logger } from "../config/logger";
import {
  ASSESSMENT_QUEUE_NAME,
  RUN_ASSESSMENT_JOB,
  BULLMQ_CONCURRENCY,
} from "../config/bullmq";
import type { IHealthAssessmentOrchestrator } from "../services/orchestrator/healthAssessment.orchestrator";
import type { AssessmentJobPayload } from "./assessment.job";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates and returns a BullMQ Worker that processes `run-assessment` jobs.
 *
 * The worker is constructed via a factory function so that the orchestrator
 * dependency can be injected at startup time (DI-friendly, testable).
 *
 * Job lifecycle:
 *   - Processes `run-assessment` jobs by delegating to `orchestrator.runAssessment`.
 *   - On failure: logs the error with the job's `correlationId` via the `failed` event.
 *
 * @param orchestrator - The health assessment orchestrator instance.
 * @returns A configured BullMQ Worker.
 */
export function createAssessmentWorker(
  orchestrator: IHealthAssessmentOrchestrator,
): Worker<AssessmentJobPayload> {
  const worker = new Worker<AssessmentJobPayload>(
    ASSESSMENT_QUEUE_NAME,
    async (job) => {
      if (job.name !== RUN_ASSESSMENT_JOB) {
        logger.warn(
          { jobId: job.id, jobName: job.name },
          "assessment-worker: received unknown job name — skipping",
        );
        return;
      }

      const { patientId, idempotencyKey, correlationId } = job.data;

      logger.info(
        { jobId: job.id, patientId, correlationId, attempt: job.attemptsMade + 1 },
        "assessment-worker: processing run-assessment job",
      );

      await orchestrator.runAssessment(patientId, idempotencyKey, correlationId);
    },
    {
      connection: redis,
      concurrency: BULLMQ_CONCURRENCY,
    },
  );

  // -------------------------------------------------------------------------
  // Event: failed
  // -------------------------------------------------------------------------
  worker.on("failed", (job, err) => {
    const correlationId = job?.data?.correlationId ?? "unknown";

    logger.error(
      {
        jobId: job?.id,
        patientId: job?.data?.patientId,
        correlationId,
        attemptsMade: job?.attemptsMade,
        error: err instanceof Error ? err.message : String(err),
      },
      "assessment-worker: job failed",
    );
  });

  return worker;
}
