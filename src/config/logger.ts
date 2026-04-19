import pino from "pino";
import { env } from "./env";

// ─── Sensitive field redaction ────────────────────────────────────────────────

/**
 * Paths that must never appear in log output.
 * Pino's `redact` option replaces these values with "[Redacted]".
 */
const REDACTED_PATHS = [
  "password",
  "accessToken",
  "refreshToken",
  // Nested variants (e.g. inside request bodies or response objects)
  "*.password",
  "*.accessToken",
  "*.refreshToken",
  "body.password",
  "body.accessToken",
  "body.refreshToken",
];

// ─── Logger ───────────────────────────────────────────────────────────────────

/**
 * Structured JSON logger.
 *
 * Log schema fields:
 *   - `timestamp`     ISO 8601 string
 *   - `level`         log level label (debug | info | warn | error)
 *   - `service`       service name constant
 *   - `correlationId` request-scoped correlation UUID (set by callers via child logger)
 *   - `message`       human-readable description
 *
 * Log level is controlled by the `LOG_LEVEL` environment variable (default: "info").
 * Sensitive fields (`password`, `accessToken`, `refreshToken`) are always redacted.
 */
export const logger = pino({
  level: env.LOG_LEVEL,

  // Rename pino's default "msg" key to "message" to match the log schema.
  messageKey: "message",

  // Use ISO 8601 timestamps instead of epoch milliseconds.
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,

  // Merge base fields into every log line.
  base: {
    service: "patient-health-risk-assessment",
  },

  // Redact sensitive fields — value is replaced with "[Redacted]".
  redact: {
    paths: REDACTED_PATHS,
    censor: "[Redacted]",
  },

  // Format level as a label string ("info") rather than a numeric value.
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

// ─── Typed child-logger helper ────────────────────────────────────────────────

/**
 * Creates a child logger pre-bound with a `correlationId`.
 * Use this inside request handlers and service methods.
 *
 * @example
 * const log = childLogger(req.correlationId);
 * log.info({ patientId }, "Starting assessment pipeline");
 */
export function childLogger(correlationId: string): pino.Logger {
  return logger.child({ correlationId });
}
