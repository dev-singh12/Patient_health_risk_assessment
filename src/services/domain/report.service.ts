import type { RiskLevel } from "../../models/domain.types";

/**
 * Level-specific messages appended to the summary string.
 */
const LEVEL_MESSAGES: Record<RiskLevel, string> = {
  LOW: "Patient is at low risk. Continue with regular health monitoring.",
  MODERATE:
    "Patient is at moderate risk. Lifestyle modifications are recommended.",
  HIGH: "Patient is at high risk. Medical intervention is advised.",
  CRITICAL:
    "Patient is at critical risk. Immediate medical attention is required.",
};

/**
 * ReportService — produces human-readable assessment summaries.
 *
 * Pure service with no database access and no repository imports.
 * Satisfies Requirement 14.5.
 */
export class ReportService {
  /**
   * Builds a human-readable summary string for a completed risk assessment.
   *
   * @param riskScore - The numeric risk score (0–100).
   * @param riskLevel - The categorical risk level derived from the score.
   * @returns A formatted summary string.
   */
  buildSummary(riskScore: number, riskLevel: RiskLevel): string {
    const levelMessage = LEVEL_MESSAGES[riskLevel];
    return (
      `Patient risk assessment complete. ` +
      `Risk score: ${riskScore}/100. ` +
      `Risk level: ${riskLevel}. ` +
      `${levelMessage}`
    );
  }
}
