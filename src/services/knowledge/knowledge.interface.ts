import type { RiskLevel } from "../../models/domain.types";

/**
 * Abstraction over the medical knowledge source.
 *
 * Both the mock (development/test) and external (production) implementations
 * satisfy this interface, making them interchangeable without any changes to
 * the Orchestrator.
 */
export interface IKnowledgeService {
  /**
   * Returns a non-empty list of evidence-based recommendation strings for the
   * given risk level.
   *
   * Implementations MUST:
   *  - Always resolve (never reject / throw).
   *  - Return at least one recommendation string.
   *  - Log a warning (with `correlationId`) and return a fallback list when
   *    the underlying data source is unavailable.
   *
   * @param riskLevel     The patient's assessed risk level.
   * @param correlationId Request-scoped correlation UUID for log tracing.
   */
  getRecommendations(
    riskLevel: RiskLevel,
    correlationId: string,
  ): Promise<string[]>;
}
