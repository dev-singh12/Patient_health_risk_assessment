import { Request, Response, NextFunction, RequestHandler } from "express";
import { logger } from "../config/logger";

/**
 * Audit log middleware factory.
 *
 * Records who accessed what patient data and when.
 * Logs: actorId, actorRole, action, patientId, correlationId, timestamp.
 *
 * Usage:
 *   router.get("/:patientId", authMiddleware, auditLog("READ_PATIENT"), handler)
 */
export function auditLog(action: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const actor = req.user;
    const patientId = req.params.patientId ?? req.params.id ?? req.body?.patientId;

    logger.info({
      audit: true,
      action,
      actorId: actor?.userId ?? "anonymous",
      actorRole: actor?.role ?? "unknown",
      patientId: patientId ?? "n/a",
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    }, `AUDIT: ${action}`);

    next();
  };
}
