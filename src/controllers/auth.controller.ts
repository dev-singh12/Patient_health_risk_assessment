import { Router, Request, Response, NextFunction } from "express";
import { AuthService } from "../services/domain/auth.service";
import { validate } from "../middleware/validate.middleware";
import { LoginSchema, RefreshSchema, LogoutSchema } from "../dtos/auth.dto";

// ---------------------------------------------------------------------------
// Singleton service instance
// ---------------------------------------------------------------------------

const authService = new AuthService();

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const authRouter = Router();

/**
 * POST /auth/login
 *
 * Validates credentials and returns a JWT access token + refresh token pair.
 * Enforces brute-force protection via the AuthService.
 *
 * Validates: Requirements 1.1, 1.2, 1.5, 10.1
 */
authRouter.post(
  "/login",
  validate(LoginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.login(
        req.body,
        req.ip ?? "",
        req.correlationId,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /auth/refresh
 *
 * Rotates the refresh token and issues a new access token.
 *
 * Validates: Requirements 1.3, 1.4, 10.1
 */
authRouter.post(
  "/refresh",
  validate(RefreshSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.refresh(req.body.refreshToken);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /auth/logout
 *
 * Invalidates the provided refresh token.
 *
 * Validates: Requirements 1.6, 10.1
 */
authRouter.post(
  "/logout",
  validate(LogoutSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.logout(req.body.refreshToken);
      res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
      next(err);
    }
  },
);
