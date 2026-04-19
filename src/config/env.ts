import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Redis
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  // JWT
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRY: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRY_DAYS: z
    .string()
    .default("7")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),

  // Knowledge Service
  KNOWLEDGE_SERVICE_IMPL: z.enum(["mock", "external"]).default("mock"),
  EXTERNAL_KNOWLEDGE_API_URL: z.string().optional(),
  EXTERNAL_KNOWLEDGE_API_KEY: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Server
  PORT: z
    .string()
    .default("3000")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default("60000")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  RATE_LIMIT_MAX: z
    .string()
    .default("100")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),

  // BullMQ
  BULLMQ_CONCURRENCY: z
    .string()
    .default("5")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),

  // Frontend URL (for CORS — set to your Vercel URL in production)
  FRONTEND_URL: z.string().default("http://localhost:5173"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const messages = result.error.errors
      .map((e) => `  ${e.path.join(".")}: ${e.message}`)
      .join("\n");

    throw new Error(
      `Environment variable validation failed:\n${messages}\n\nFull details: ${JSON.stringify(formatted, null, 2)}`,
    );
  }

  return result.data;
}

export const env: Env = loadEnv();
