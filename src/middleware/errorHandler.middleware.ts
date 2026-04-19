import { Request, Response, NextFunction } from "express";
import {
  AppError,
  ValidationError,
  PipelineError,
} from "../errors";
import { logger } from "../config/logger";

/**
 * Global Express error handler middleware.
 *
 * MUST be registered as the last middleware in the Express application so that
 * errors thrown (or passed via `next(err)`) from all preceding middleware and
 * route handlers are caught here.
 *
 * Behaviour:
 * - If `err` is an `AppError` subclass, uses `err.statusCode` and `err.code`.
 * - Otherwise, responds with HTTP 500 and code `INTERNAL_SERVER_ERROR`.
 * - Always includes `correlationId` from `req.correlationId` in the response.
 * - For `ValidationError`: includes the `fields` map in the error body.
 * - For `PipelineError`: includes `stageName` in the error body.
 * - Logs the full error (including stack trace) at `error` level.
 * - NEVER exposes stack traces in the response body.
 *
 * Validates: Requirements 10.4, 2.2, 2.3
 */
export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Log the full error with stack trace for observability.
  logger.error(
    {
      correlationId: req.correlationId,
      errorType: err.constructor.name,
      errorMessage: err.message,
      stack: err.stack,
    },
    "Unhandled error",
  );

  if (err instanceof AppError) {
    const errorBody: Record<string, unknown> = {
      code: err.code,
      message: err.message,
      correlationId: req.correlationId,
    };

    // Include per-field validation details for ValidationError.
    if (err instanceof ValidationError && err.fields) {
      errorBody.fields = err.fields;
    }

    // Include the failing stage name for PipelineError.
    if (err instanceof PipelineError) {
      errorBody.stageName = err.stageName;
    }

    res.status(err.statusCode).json({ error: errorBody });
    return;
  }

  // Unknown / unexpected error — never leak internals.
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      correlationId: req.correlationId,
    },
  });
}
