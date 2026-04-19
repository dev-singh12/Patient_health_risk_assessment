import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis";
import { env } from "../config/env";
import { logger } from "../config/logger";

/**
 * In-memory fallback store for rate limiting when Redis is unavailable.
 *
 * Each entry holds the current request count and the timestamp at which the
 * window expires. Entries are cleaned up lazily on each access.
 */
const inMemoryStore = new Map<string, { count: number; expiresAt: number }>();

/**
 * Increments the in-memory counter for the given key and returns the new count.
 * The window resets after `windowMs` milliseconds.
 */
function inMemoryIncrement(key: string, windowMs: number): number {
  const now = Date.now();
  const entry = inMemoryStore.get(key);

  if (!entry || now >= entry.expiresAt) {
    inMemoryStore.set(key, { count: 1, expiresAt: now + windowMs });
    return 1;
  }

  entry.count += 1;
  return entry.count;
}

/**
 * Rate limiter middleware.
 *
 * Uses a Redis INCR + EXPIRE sliding-window approximation keyed by
 * `ratelimit:{ip}`. Falls back to an in-memory Map when Redis is unavailable.
 * Returns HTTP 429 with a structured error body when the limit is exceeded.
 *
 * Environment variables:
 *   - `RATE_LIMIT_WINDOW_MS` — window duration in milliseconds (default 60 000)
 *   - `RATE_LIMIT_MAX`       — maximum requests per window per IP (default 100)
 *
 * Validates: Requirements 10.5, 12.4
 */
export async function rateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const ip = req.ip ?? "unknown";
  const key = `ratelimit:${ip}`;
  const windowMs = env.RATE_LIMIT_WINDOW_MS;
  const max = env.RATE_LIMIT_MAX;

  let count: number;

  try {
    // INCR atomically increments (or initialises to 1) the counter.
    count = await redis.incr(key);

    // On the first request in a new window, set the expiry.
    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }
  } catch (redisError) {
    // Redis unavailable — fall back to in-memory store and log a warning.
    logger.warn(
      {
        correlationId: req.correlationId,
        ip,
        error: (redisError as Error).message,
      },
      "Redis unavailable for rate limiting — falling back to in-memory store",
    );
    count = inMemoryIncrement(key, windowMs);
  }

  if (count > max) {
    res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests",
        correlationId: req.correlationId,
      },
    });
    return;
  }

  next();
}
