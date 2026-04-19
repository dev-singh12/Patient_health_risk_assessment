/**
 * ML Risk Engine — pure function module.
 *
 * calculateRisk() is the sole export. It has zero side effects:
 *   - No database access
 *   - No HTTP calls
 *   - No mutable module-level state
 *
 * Imports are restricted to src/errors/ and src/services/ml/weights.ts
 * as required by the layered architecture rules (Requirement 14.3).
 */

import { InvalidMetricsError } from "../../errors/index";
import {
  AGE_MAX,
  AGE_MIN,
  BMI_MIN,
  BMI_RANGE,
  BP_MIN,
  BP_RANGE,
  CHOLESTEROL_MIN,
  CHOLESTEROL_RANGE,
  GLUCOSE_MIN,
  GLUCOSE_RANGE,
  SMOKING_CURRENT_FACTOR,
  SMOKING_FORMER_FACTOR,
  SMOKING_NEVER_FACTOR,
  THRESHOLD_CRITICAL,
  THRESHOLD_HIGH,
  THRESHOLD_MODERATE,
  WEIGHT_AGE,
  WEIGHT_BMI,
  WEIGHT_BLOOD_PRESSURE,
  WEIGHT_CHOLESTEROL,
  WEIGHT_GLUCOSE,
  WEIGHT_SMOKING,
} from "./weights";

// ---------------------------------------------------------------------------
// Local type aliases (mirrors domain.types.ts without importing from models/)
// ---------------------------------------------------------------------------

type SmokingStatus = "NEVER" | "FORMER" | "CURRENT";
type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface ClinicalMetrics {
  age: number;
  bloodPressure: number; // systolic mmHg
  glucoseLevel: number; // mg/dL
  bmi: number;
  cholesterol: number; // mg/dL
  smokingStatus: SmokingStatus;
}

export interface RiskResult {
  riskScore: number; // 0–100 inclusive
  riskLevel: RiskLevel;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamps a value to the inclusive range [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Validates that all required fields are present and not undefined.
 * Throws InvalidMetricsError listing every missing field if any are absent.
 */
function validateMetrics(metrics: unknown): asserts metrics is ClinicalMetrics {
  const required: Array<keyof ClinicalMetrics> = [
    "age",
    "bloodPressure",
    "glucoseLevel",
    "bmi",
    "cholesterol",
    "smokingStatus",
  ];

  const missing: string[] = [];

  if (metrics === null || metrics === undefined || typeof metrics !== "object") {
    throw new InvalidMetricsError(required);
  }

  const obj = metrics as Record<string, unknown>;

  for (const field of required) {
    if (obj[field] === undefined || obj[field] === null) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new InvalidMetricsError(missing);
  }
}

/**
 * Maps a smoking status string to its numeric factor.
 */
function smokingFactor(status: SmokingStatus): number {
  switch (status) {
    case "NEVER":
      return SMOKING_NEVER_FACTOR;
    case "FORMER":
      return SMOKING_FORMER_FACTOR;
    case "CURRENT":
      return SMOKING_CURRENT_FACTOR;
  }
}

/**
 * Maps a clamped risk score to the corresponding RiskLevel.
 *
 * Thresholds (inclusive lower bound):
 *   0  – 24  → LOW
 *   25 – 49  → MODERATE
 *   50 – 74  → HIGH
 *   75 – 100 → CRITICAL
 */
function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= THRESHOLD_CRITICAL) return "CRITICAL";
  if (score >= THRESHOLD_HIGH) return "HIGH";
  if (score >= THRESHOLD_MODERATE) return "MODERATE";
  return "LOW";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculates the health risk score and level for a patient given their
 * clinical metrics.
 *
 * @param metrics - A ClinicalMetrics object with all required fields present.
 * @returns A RiskResult containing riskScore (0–100) and riskLevel.
 * @throws {InvalidMetricsError} If any required field is missing or undefined.
 */
export function calculateRisk(metrics: ClinicalMetrics): RiskResult {
  // 1. Validate — throws InvalidMetricsError if any field is missing
  validateMetrics(metrics);

  // 2. Compute normalised sub-scores, each clamped to [0, 1]
  const ageNorm = clamp(
    (metrics.age - AGE_MIN) / (AGE_MAX - AGE_MIN),
    0,
    1,
  );

  const bpNorm = clamp(
    (metrics.bloodPressure - BP_MIN) / BP_RANGE,
    0,
    1,
  );

  const glucoseNorm = clamp(
    (metrics.glucoseLevel - GLUCOSE_MIN) / GLUCOSE_RANGE,
    0,
    1,
  );

  const bmiNorm = clamp(
    (metrics.bmi - BMI_MIN) / BMI_RANGE,
    0,
    1,
  );

  const cholesterolNorm = clamp(
    (metrics.cholesterol - CHOLESTEROL_MIN) / CHOLESTEROL_RANGE,
    0,
    1,
  );

  const smokingNorm = smokingFactor(metrics.smokingStatus);

  // 3. Compute weighted sub-scores and sum them
  const rawScore =
    ageNorm * WEIGHT_AGE +
    bpNorm * WEIGHT_BLOOD_PRESSURE +
    glucoseNorm * WEIGHT_GLUCOSE +
    bmiNorm * WEIGHT_BMI +
    cholesterolNorm * WEIGHT_CHOLESTEROL +
    smokingNorm * WEIGHT_SMOKING;

  // 4. Clamp to [0, 100] (weights already sum to 100, but clamping is
  //    required by the spec to guard against floating-point edge cases)
  const riskScore = clamp(rawScore, 0, 100);

  // 5. Map score to risk level using exact threshold boundaries
  const riskLevel = scoreToRiskLevel(riskScore);

  return { riskScore, riskLevel };
}
