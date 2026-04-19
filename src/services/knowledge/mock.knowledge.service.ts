import type { RiskLevel } from "../../models/domain.types";
import type { IKnowledgeService } from "./knowledge.interface";

/**
 * Hardcoded recommendation arrays keyed by RiskLevel.
 * Used in development and test environments.
 */
const RECOMMENDATIONS: Record<RiskLevel, string[]> = {
  LOW: [
    "Maintain healthy lifestyle",
    "Regular check-ups annually",
  ],
  MODERATE: [
    "Increase physical activity",
    "Monitor blood pressure weekly",
    "Reduce sodium intake",
  ],
  HIGH: [
    "Consult cardiologist",
    "Daily blood pressure monitoring",
    "Medication review required",
    "Strict dietary changes",
  ],
  CRITICAL: [
    "Immediate medical attention required",
    "Emergency cardiology consultation",
    "Hospitalisation may be necessary",
    "Continuous monitoring required",
  ],
};

/**
 * Mock implementation of IKnowledgeService.
 *
 * Returns hardcoded recommendation arrays keyed by riskLevel.
 * Never throws; always returns at least one recommendation.
 * Suitable for development and test environments.
 */
export class MockKnowledgeService implements IKnowledgeService {
  async getRecommendations(
    riskLevel: RiskLevel,
    _correlationId: string,
  ): Promise<string[]> {
    return RECOMMENDATIONS[riskLevel];
  }
}
