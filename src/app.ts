import express from "express";
import { correlationIdMiddleware } from "./middleware/correlationId.middleware";
import { rateLimiterMiddleware } from "./middleware/rateLimiter.middleware";
import { requestLoggerMiddleware } from "./middleware/requestLogger.middleware";
import { errorHandlerMiddleware } from "./middleware/errorHandler.middleware";
import router from "./routes/index";

/**
 * Express application.
 *
 * Middleware stack (in order):
 *   1. correlationId    — assigns X-Correlation-ID to every request
 *   2. requestLogger    — logs latency, method, path, status; warns on slow requests
 *   3. rateLimiter      — Redis-backed per-IP rate limiting
 *   4. express.json()   — parses JSON request bodies
 *   5. router           — all application routes
 *   6. errorHandler     — global catch-all (must be last)
 */
const app = express();

app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(rateLimiterMiddleware);
app.use(express.json());
app.use(router);
app.use(errorHandlerMiddleware);

export default app;
