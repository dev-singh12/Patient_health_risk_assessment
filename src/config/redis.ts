import Redis from "ioredis";
import { env } from "./env";

let redisClient: Redis | null = null;

function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on("error", (err: Error) => {
    // Use process.stderr directly here — importing logger would create a
    // circular dependency (logger → env → already loaded).
    process.stderr.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        service: "patient-health-risk-assessment",
        message: "Redis connection error — cache unavailable, falling back to DB",
        error: err.message,
      }) + "\n",
    );
  });

  client.on("connect", () => {
    process.stdout.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        service: "patient-health-risk-assessment",
        message: "Redis connected",
      }) + "\n",
    );
  });

  return client;
}

/**
 * Singleton ioredis client.
 * On connection failure the client emits a structured warn log and the
 * application continues running (graceful degradation).
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

export const redis = getRedisClient();
