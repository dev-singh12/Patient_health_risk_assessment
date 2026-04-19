import { Router, Request, Response } from "express";
import { db } from "../config/db";
import { redis } from "../config/redis";
import { sql } from "drizzle-orm";

export const healthRouter = Router();

const startTime = Date.now();

/**
 * GET /health
 * Liveness + readiness probe. Checks DB and Redis connectivity.
 */
healthRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string }> = {};

  // DB check
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: "error", error: (err as Error).message };
  }

  // Redis check
  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { status: "ok", latencyMs: Date.now() - redisStart };
  } catch (err) {
    checks.redis = { status: "error", error: (err as Error).message };
  }

  const allOk = Object.values(checks).every(c => c.status === "ok");
  const statusCode = allOk ? 200 : 503;

  res.status(statusCode).json({
    status: allOk ? "ok" : "degraded",
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /metrics
 * Basic process metrics for observability.
 */
healthRouter.get("/metrics", (_req: Request, res: Response): void => {
  const mem = process.memoryUsage();
  res.status(200).json({
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
    },
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
    },
  });
});
