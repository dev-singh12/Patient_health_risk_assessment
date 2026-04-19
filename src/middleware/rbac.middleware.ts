import { Request, Response, NextFunction, RequestHandler } from "express";
import { Role } from "../models/domain.types";
import { AuthorizationError } from "../errors";

/**
 * RBAC middleware factory.
 *
 * Returns an Express `RequestHandler` that checks whether the authenticated
 * user's role matches `requiredRole`. If the user is not authenticated or
 * their role does not match, an `AuthorizationError` is thrown and propagates
 * to the global error handler (HTTP 403).
 *
 * Usage:
 * ```typescript
 * router.get("/admin", authMiddleware, rbac("HEALTHCARE_STAFF"), handler);
 * ```
 *
 * Validates: Requirements 2.3, 2.4, 2.5
 */
export function rbac(requiredRole: Role): RequestHandler {
  return function rbacMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    if (!req.user) {
      return next(new AuthorizationError("Insufficient permissions"));
    }

    if (req.user.role !== requiredRole) {
      return next(new AuthorizationError("Insufficient permissions"));
    }

    next();
  };
}
