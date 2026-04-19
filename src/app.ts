import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { correlationIdMiddleware } from "./middleware/correlationId.middleware";
import { rateLimiterMiddleware } from "./middleware/rateLimiter.middleware";
import { requestLoggerMiddleware } from "./middleware/requestLogger.middleware";
import { errorHandlerMiddleware } from "./middleware/errorHandler.middleware";
import router from "./routes/index";

/**
 * Express application.
 *
 * Middleware stack (in order):
 *   1. cors            — allow requests from the frontend (Vercel or localhost)
 *   2. correlationId   — assigns X-Correlation-ID to every request
 *   3. requestLogger   — logs latency, method, path, status
 *   4. rateLimiter     — Redis-backed per-IP rate limiting
 *   5. express.json()  — parses JSON request bodies
 *   6. router          — all application routes
 *   7. errorHandler    — global catch-all (must be last)
 */
const app = express();

// CORS — allow the frontend origin (set FRONTEND_URL in env for production)
app.use(cors({
  origin: [
    env.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-ID"],
  exposedHeaders: ["X-Correlation-ID"],
}));

app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(rateLimiterMiddleware);
app.use(express.json());
app.use(router);
app.use(errorHandlerMiddleware);

export default app;
