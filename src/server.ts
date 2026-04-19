// Load .env in local development — Render injects env vars directly in production
if (process.env.NODE_ENV !== "production") {
  require("dotenv/config");
}

import http from "http";
import app from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { redis } from "./config/redis";
import { createAssessmentWorker } from "./jobs/assessment.worker";
import { HealthAssessmentOrchestrator } from "./services/orchestrator/healthAssessment.orchestrator";
import { RiskService } from "./services/domain/risk.service";
import { ReportService } from "./services/domain/report.service";
import { RecommendationService } from "./services/domain/recommendation.service";
import { knowledgeService } from "./services/knowledge/index";
import { ClinicalDataRepository } from "./repositories/clinicalData.repository";
import { AssessmentRepository } from "./repositories/assessment.repository";
import { ReportRepository } from "./repositories/report.repository";

// ── Compose the orchestrator ──────────────────────────────────────────────
const orchestrator = new HealthAssessmentOrchestrator(
  new RiskService(),
  new ReportService(),
  new RecommendationService(knowledgeService),
  new ClinicalDataRepository(),
  new AssessmentRepository(),
  new ReportRepository(),
  redis,
  logger,
);

// ── Start BullMQ worker (non-fatal if Redis is temporarily unavailable) ───
try {
  const worker = createAssessmentWorker(orchestrator);

  worker.on("ready", () => {
    logger.info("Assessment worker ready");
  });

  worker.on("error", (err) => {
    logger.error({ error: err.message }, "Assessment worker error");
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutdown signal received");
    server.close(async () => {
      await worker.close();
      logger.info("Server and worker closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

} catch (err) {
  logger.warn({ error: (err as Error).message },
    "BullMQ worker failed to start — async assessment processing unavailable");

  // Still shut down the HTTP server cleanly
  process.on("SIGTERM", () => { server.close(() => process.exit(0)); });
  process.on("SIGINT",  () => { server.close(() => process.exit(0)); });
}

// ── Start HTTP server ─────────────────────────────────────────────────────
// Render injects PORT automatically; fallback to 10000 for safety
const PORT = env.PORT || 10000;

const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(
    { port: PORT, nodeEnv: env.NODE_ENV },
    `Patient Health Risk Assessment API listening on port ${PORT}`,
  );
});

export default server;
