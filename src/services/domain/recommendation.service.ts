import type { IKnowledgeService } from "../knowledge/knowledge.interface";
import type { RiskLevel } from "../../models/domain.types";

/**
 * RecommendationService — thin domain-layer wrapper around IKnowledgeService.
 *
 * Delegates directly to the injected knowledge service implementation,
 * keeping the Orchestrator decoupled from the concrete knowledge source.
 * Satisfies Requirement 14.5.
 */
export class RecommendationService {
  constructor(private readonly knowledgeService: IKnowledgeService) {}

  /**
   * Returns evidence-based recommendations for the given risk level.
   *
   * @param riskLevel     - The patient's assessed risk level.
   * @param correlationId - Request-scoped correlation UUID for log tracing.
   * @returns A non-empty array of recommendation strings.
   */
  getRecommendations(
    riskLevel: RiskLevel,
    correlationId: string,
  ): Promise<string[]> {
    return this.knowledgeService.getRecommendations(riskLevel, correlationId);
  }
}
