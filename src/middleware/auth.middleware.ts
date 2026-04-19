import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthenticationError } from "../errors";

/**
 * Shape of the JWT payload issued by the Auth Service.
 */
interface JwtPayload {
  userId: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Auth middleware.
 *
 * Verifies the `Authorization: Bearer <token>` header using `JWT_SECRET`.
 * On success, attaches `req.user = { userId, role }` and calls `next()`.
 * On any failure (missing header, invalid signature, expired token), throws
 * an `AuthenticationError` which propagates to the global error handler.
 *
 * Validates: Requirements 2.2, 10.2
 */
export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AuthenticationError("Authentication required"));
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch {
    next(new AuthenticationError("Invalid or expired token"));
  }
}
