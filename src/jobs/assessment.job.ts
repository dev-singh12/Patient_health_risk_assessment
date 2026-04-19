import type { Job } from "bullmq";
import {
  assessmentQueue,
  RUN_ASSESSMENT_JOB,
  defaultJobOptions,
} from "../config/bullmq";

// ---------------------------------------------------------------------------
// Payload type
// ---------------------------------------------------------------------------

export interface AssessmentJobPayload {
  patientId: string;
  idempotencyKey: string;
  correlationId: string;
}

// ---------------------------------------------------------------------------
// Enqueue helper
// ---------------------------------------------------------------------------

/**
 * Enqueues a `run-assessment` job on the `assessment-queue`.
 *
 * Retry policy (from `defaultJobOptions`):
 *   - 3 attempts
 *   - Exponential backoff: ~1 s, ~5 s, ~30 s
 *
 * @param payload - Job data containing patientId, idempotencyKey, and correlationId.
 * @returns The BullMQ Job instance created by the queue.
 */
export async function enqueueAssessment(
  payload: AssessmentJobPayload,
): Promise<Job<AssessmentJobPayload>> {
  return assessmentQueue.add(RUN_ASSESSMENT_JOB, payload, defaultJobOptions);
}
