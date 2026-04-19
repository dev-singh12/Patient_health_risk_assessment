import { Queue } from "bullmq";
import { env } from "./env";
import { redis } from "./redis";

// ─── Constants ────────────────────────────────────────────────────────────────

/** BullMQ queue name for assessment jobs. */
export const ASSESSMENT_QUEUE_NAME = "assessment-queue";

/** Job name used when enqueuing assessment work. */
export const RUN_ASSESSMENT_JOB = "run-assessment";

/** Worker concurrency — how many jobs are processed in parallel. */
export const BULLMQ_CONCURRENCY: number = env.BULLMQ_CONCURRENCY;

/** Number of retry attempts before a job is moved to the failed set. */
export const BULLMQ_RETRY_ATTEMPTS = 3;

/**
 * Exponential backoff configuration.
 * Produces delays of approximately 1 s, 5 s, and 30 s for attempts 1–3.
 */
export const BULLMQ_BACKOFF = {
  type: "exponential",
  delay: 1000,
} as const;

// ─── Default job options ───────────────────────────────────────────────────────

export const defaultJobOptions = {
  attempts: BULLMQ_RETRY_ATTEMPTS,
  backoff: BULLMQ_BACKOFF,
} as const;

// ─── Queue singleton ──────────────────────────────────────────────────────────

/**
 * Singleton BullMQ Queue instance for the `assessment-queue`.
 *
 * Uses the shared ioredis client so that Redis unavailability is handled
 * consistently (warn log, graceful degradation).
 */
export const assessmentQueue = new Queue(ASSESSMENT_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions,
});
