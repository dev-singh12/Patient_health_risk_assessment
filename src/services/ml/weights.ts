/**
 * Weight constants for the ML Risk Engine.
 *
 * All weights sum to 100 so that the raw weighted sum is naturally in [0, 100]
 * before clamping. Each constant represents the maximum contribution (in score
 * points) that the corresponding metric can add to the final risk score.
 *
 * Normalisation formulas used in riskEngine.ts:
 *   age          : (age - AGE_MIN) / (AGE_MAX - AGE_MIN)   (0–1 for age 0–100)
 *   bloodPressure: (bp - BP_MIN) / BP_RANGE                 (0–1 for bp 80–200)
 *   glucoseLevel : (glucose - GLUCOSE_MIN) / GLUCOSE_RANGE  (0–1 for glucose 70–300)
 *   bmi          : (bmi - BMI_MIN) / BMI_RANGE              (0–1 for bmi 18.5–40)
 *   cholesterol  : (chol - CHOLESTEROL_MIN) / CHOLESTEROL_RANGE (0–1 for chol 150–300)
 *   smokingStatus: NEVER=0, FORMER=0.5, CURRENT=1.0
 *
 * All normalised values are clamped to [0, 1] before multiplication so that
 * extreme inputs cannot push the sub-score below 0 or above the weight.
 */

/** Maximum score contribution from age (years). */
export const WEIGHT_AGE = 20;

/** Maximum score contribution from systolic blood pressure (mmHg). */
export const WEIGHT_BLOOD_PRESSURE = 20;

/** Maximum score contribution from fasting glucose level (mg/dL). */
export const WEIGHT_GLUCOSE = 20;

/** Maximum score contribution from body-mass index. */
export const WEIGHT_BMI = 15;

/** Maximum score contribution from total cholesterol (mg/dL). */
export const WEIGHT_CHOLESTEROL = 15;

/** Maximum score contribution from smoking status. */
export const WEIGHT_SMOKING = 10;

// ---------------------------------------------------------------------------
// Normalisation baseline / range constants
// ---------------------------------------------------------------------------

/** Minimum age used for normalisation (below this → sub-score 0). */
export const AGE_MIN = 0;

/** Maximum age used for normalisation (above this → sub-score clamped to WEIGHT_AGE). */
export const AGE_MAX = 100;

/** Minimum blood pressure (mmHg) used for normalisation. */
export const BP_MIN = 80;

/** Range of blood pressure used for normalisation (BP_MIN + BP_RANGE = 200 mmHg). */
export const BP_RANGE = 120;

/** Minimum glucose level (mg/dL) used for normalisation. */
export const GLUCOSE_MIN = 70;

/** Range of glucose used for normalisation (GLUCOSE_MIN + GLUCOSE_RANGE = 300 mg/dL). */
export const GLUCOSE_RANGE = 230;

/** Minimum BMI used for normalisation. */
export const BMI_MIN = 18.5;

/** Range of BMI used for normalisation (BMI_MIN + BMI_RANGE = 40). */
export const BMI_RANGE = 21.5;

/** Minimum cholesterol (mg/dL) used for normalisation. */
export const CHOLESTEROL_MIN = 150;

/** Range of cholesterol used for normalisation (CHOLESTEROL_MIN + CHOLESTEROL_RANGE = 300 mg/dL). */
export const CHOLESTEROL_RANGE = 150;

// ---------------------------------------------------------------------------
// Smoking status multipliers (applied to WEIGHT_SMOKING)
// ---------------------------------------------------------------------------

/** Smoking multiplier for never-smokers. */
export const SMOKING_NEVER_FACTOR = 0;

/** Smoking multiplier for former smokers. */
export const SMOKING_FORMER_FACTOR = 0.5;

/** Smoking multiplier for current smokers. */
export const SMOKING_CURRENT_FACTOR = 1.0;

// ---------------------------------------------------------------------------
// Risk-level threshold boundaries (inclusive lower bound of each band)
// ---------------------------------------------------------------------------

/** Minimum score for MODERATE risk (scores below this are LOW). */
export const THRESHOLD_MODERATE = 25;

/** Minimum score for HIGH risk (scores below this are MODERATE). */
export const THRESHOLD_HIGH = 50;

/** Minimum score for CRITICAL risk (scores below this are HIGH). */
export const THRESHOLD_CRITICAL = 75;
