import { logger } from "../../config/logger";
import { env } from "../../config/env";
import type { RiskLevel } from "../../models/domain.types";
import type { IKnowledgeService } from "./knowledge.interface";

// ---------------------------------------------------------------------------
// Fallback recommendations
// ---------------------------------------------------------------------------

const FALLBACK_RECOMMENDATIONS: Record<RiskLevel, string[]> = {
  LOW:      ["Maintain healthy lifestyle", "Regular check-ups annually"],
  MODERATE: ["Increase physical activity", "Monitor blood pressure weekly", "Reduce sodium intake"],
  HIGH:     ["Consult cardiologist", "Daily blood pressure monitoring", "Medication review required", "Strict dietary changes"],
  CRITICAL: ["Immediate medical attention required", "Emergency cardiology consultation", "Hospitalisation may be necessary", "Continuous monitoring required"],
};

// ---------------------------------------------------------------------------
// Circuit breaker state
// ---------------------------------------------------------------------------

const CIRCUIT = {
  failures: 0,
  lastFailureTime: 0,
  state: "CLOSED" as "CLOSED" | "OPEN" | "HALF_OPEN",
  FAILURE_THRESHOLD: 5,
  RECOVERY_TIMEOUT_MS: 30_000, // 30 s
  REQUEST_TIMEOUT_MS: 5_000,   // 5 s per attempt
  MAX_RETRIES: 2,
};

function isCircuitOpen(): boolean {
  if (CIRCUIT.state === "OPEN") {
    if (Date.now() - CIRCUIT.lastFailureTime > CIRCUIT.RECOVERY_TIMEOUT_MS) {
      CIRCUIT.state = "HALF_OPEN";
      return false;
    }
    return true;
  }
  return false;
}

function recordSuccess(): void {
  CIRCUIT.failures = 0;
  CIRCUIT.state = "CLOSED";
}

function recordFailure(): void {
  CIRCUIT.failures += 1;
  CIRCUIT.lastFailureTime = Date.now();
  if (CIRCUIT.failures >= CIRCUIT.FAILURE_THRESHOLD) {
    CIRCUIT.state = "OPEN";
  }
}

// ---------------------------------------------------------------------------
// Fetch with timeout
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, apiKey: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// ExternalKnowledgeService
// ---------------------------------------------------------------------------

export class ExternalKnowledgeService implements IKnowledgeService {
  async getRecommendations(riskLevel: RiskLevel, correlationId: string): Promise<string[]> {
    const baseUrl = env.EXTERNAL_KNOWLEDGE_API_URL;
    const apiKey  = env.EXTERNAL_KNOWLEDGE_API_KEY;

    if (!baseUrl || !apiKey) {
      logger.warn({ correlationId, riskLevel }, "KnowledgeService: API not configured — using fallback");
      return FALLBACK_RECOMMENDATIONS[riskLevel];
    }

    // Circuit breaker — fail fast when the service is known to be down
    if (isCircuitOpen()) {
      logger.warn({ correlationId, riskLevel, circuitState: CIRCUIT.state },
        "KnowledgeService: circuit OPEN — using fallback");
      return FALLBACK_RECOMMENDATIONS[riskLevel];
    }

    const url = `${baseUrl}/recommendations?riskLevel=${encodeURIComponent(riskLevel)}`;

    for (let attempt = 1; attempt <= CIRCUIT.MAX_RETRIES + 1; attempt++) {
      try {
        const response = await fetchWithTimeout(url, apiKey, CIRCUIT.REQUEST_TIMEOUT_MS);

        if (!response.ok) {
          logger.warn({ correlationId, riskLevel, statusCode: response.status, attempt },
            "KnowledgeService: non-2xx response");
          recordFailure();
          if (attempt <= CIRCUIT.MAX_RETRIES) continue;
          return FALLBACK_RECOMMENDATIONS[riskLevel];
        }

        const data = (await response.json()) as { recommendations: string[] };

        if (!Array.isArray(data.recommendations) || data.recommendations.length === 0) {
          logger.warn({ correlationId, riskLevel }, "KnowledgeService: empty response — using fallback");
          return FALLBACK_RECOMMENDATIONS[riskLevel];
        }

        recordSuccess();
        return data.recommendations;

      } catch (err) {
        const isTimeout = err instanceof Error && err.name === "AbortError";
        logger.warn({ correlationId, riskLevel, attempt, timeout: isTimeout, error: (err as Error).message },
          "KnowledgeService: request failed");
        recordFailure();

        if (attempt <= CIRCUIT.MAX_RETRIES) {
          // Exponential backoff: 200ms, 400ms
          await new Promise(r => setTimeout(r, 200 * attempt));
          continue;
        }
        return FALLBACK_RECOMMENDATIONS[riskLevel];
      }
    }

    return FALLBACK_RECOMMENDATIONS[riskLevel];
  }
}
