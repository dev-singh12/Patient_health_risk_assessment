import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

const SLOW_REQUEST_THRESHOLD_MS = 1000;

/**
 * Request/response logger middleware.
 *
 * Logs every inbound request and its response with:
 *   - method, path, status code
 *   - latency in milliseconds
 *   - correlationId
 *   - slow-query warning when latency > SLOW_REQUEST_THRESHOLD_MS
 *
 * Sensitive paths (auth) are logged without body details.
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();

  res.on("finish", () => {
    const latencyMs = Date.now() - startTime;
    const logData = {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      latencyMs,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };

    if (latencyMs > SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn({ ...logData, slow: true }, "Slow request detected");
    } else if (res.statusCode >= 500) {
      logger.error(logData, "Request completed with server error");
    } else if (res.statusCode >= 400) {
      logger.warn(logData, "Request completed with client error");
    } else {
      logger.info(logData, "Request completed");
    }
  });

  next();
}
