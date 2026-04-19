import { calculateRisk as mlCalculateRisk } from "../ml/riskEngine";
import type { ClinicalMetrics, RiskResult } from "../../models/domain.types";

/**
 * RiskService — domain-layer wrapper around the ML Risk Engine.
 *
 * Delegates directly to the pure `calculateRisk` function from the ML engine.
 * Imports are restricted to `src/services/ml/` and `src/errors/` as required
 * by the layered architecture rules (Requirement 14.2).
 */
export class RiskService {
  /**
   * Calculates the health risk score and level for a patient given their
   * clinical metrics.
   *
   * @param metrics - A ClinicalMetrics object with all required fields present.
   * @returns A RiskResult containing riskScore (0–100) and riskLevel.
   * @throws {InvalidMetricsError} If any required field is missing or undefined.
   */
  calculateRisk(metrics: ClinicalMetrics): RiskResult {
    return mlCalculateRisk(metrics);
  }
}
