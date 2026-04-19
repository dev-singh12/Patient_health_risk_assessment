import "dotenv/config"; // must be first — loads .env before any other imports
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

// ── Start BullMQ worker ───────────────────────────────────────────────────
const worker = createAssessmentWorker(orchestrator);

worker.on("ready", () => {
  logger.info("Assessment worker ready");
});

// ── Start HTTP server ─────────────────────────────────────────────────────
const server = http.createServer(app);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV },
    `Patient Health Risk Assessment API listening on port ${env.PORT}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown signal received");
  server.close(async () => {
    await worker.close();
    logger.info("Server and worker closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

export default server;
