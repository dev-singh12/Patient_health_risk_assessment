import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

/**
 * Correlation ID middleware.
 *
 * Generates a UUID v4 for every inbound request, attaches it to `req.correlationId`,
 * and echoes it back to the client via the `X-Correlation-ID` response header.
 *
 * This middleware MUST be the first in the stack so that all subsequent
 * middleware and handlers have access to the correlation ID.
 *
 * Validates: Requirements 10.3
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const correlationId = uuidv4();
  req.correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);
  next();
}
