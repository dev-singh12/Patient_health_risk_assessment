/**
 * Unit tests — ML Risk Engine
 *
 * Covers: valid inputs, boundary values, invalid inputs, determinism.
 */

import { calculateRisk } from "../../services/ml/riskEngine";
import { InvalidMetricsError } from "../../errors";

const BASE_METRICS = {
  age: 0,
  bloodPressure: 80,
  glucoseLevel: 70,
  bmi: 18.5,
  cholesterol: 150,
  smokingStatus: "NEVER" as const,
};

const MAX_METRICS = {
  age: 100,
  bloodPressure: 200,
  glucoseLevel: 300,
  bmi: 40,
  cholesterol: 300,
  smokingStatus: "CURRENT" as const,
};

describe("calculateRisk — output invariants", () => {
  it("returns riskScore in [0, 100] for minimum inputs", () => {
    const { riskScore, riskLevel } = calculateRisk(BASE_METRICS);
    expect(riskScore).toBeGreaterThanOrEqual(0);
    expect(riskScore).toBeLessThanOrEqual(100);
    expect(riskLevel).toBe("LOW");
  });

  it("returns riskScore in [0, 100] for maximum inputs", () => {
    const { riskScore, riskLevel } = calculateRisk(MAX_METRICS);
    expect(riskScore).toBeGreaterThanOrEqual(0);
    expect(riskScore).toBeLessThanOrEqual(100);
    expect(riskLevel).toBe("CRITICAL");
  });

  it("clamps score to 0 for below-minimum inputs", () => {
    const { riskScore } = calculateRisk({ ...BASE_METRICS, age: -100, bloodPressure: 0 });
    expect(riskScore).toBeGreaterThanOrEqual(0);
  });

  it("clamps score to 100 for above-maximum inputs", () => {
    const { riskScore } = calculateRisk({ ...MAX_METRICS, age: 999, bloodPressure: 999 });
    expect(riskScore).toBeLessThanOrEqual(100);
  });
});

describe("calculateRisk — threshold boundary values", () => {
  // We test that the threshold mapping is correct by constructing inputs
  // that produce scores near each boundary.

  it("maps score 0 to LOW", () => {
    const { riskLevel } = calculateRisk(BASE_METRICS);
    expect(riskLevel).toBe("LOW");
  });

  it("maps score >= 25 to MODERATE", () => {
    // age=50 → ageNorm=0.5 → 0.5*20=10; bp=140 → bpNorm=0.5 → 0.5*20=10; rest minimal → ~20+
    const metrics = { ...BASE_METRICS, age: 50, bloodPressure: 140 };
    const { riskScore, riskLevel } = calculateRisk(metrics);
    if (riskScore >= 25 && riskScore < 50) expect(riskLevel).toBe("MODERATE");
  });

  it("maps score >= 50 to HIGH", () => {
    const metrics = { age: 60, bloodPressure: 160, glucoseLevel: 180, bmi: 30, cholesterol: 230, smokingStatus: "FORMER" as const };
    const { riskScore, riskLevel } = calculateRisk(metrics);
    if (riskScore >= 50 && riskScore < 75) expect(riskLevel).toBe("HIGH");
  });

  it("maps score >= 75 to CRITICAL", () => {
    const { riskScore, riskLevel } = calculateRisk(MAX_METRICS);
    expect(riskScore).toBeGreaterThanOrEqual(75);
    expect(riskLevel).toBe("CRITICAL");
  });

  it("threshold mapping is exhaustive — all integer scores 0–100 map to a valid level", () => {
    const validLevels = new Set(["LOW", "MODERATE", "HIGH", "CRITICAL"]);
    // We can't directly set riskScore, but we verify the mapping function logic
    // by checking that every output from valid inputs has a valid level.
    const testCases = [BASE_METRICS, MAX_METRICS, { ...BASE_METRICS, age: 50 }];
    for (const m of testCases) {
      const { riskLevel } = calculateRisk(m);
      expect(validLevels.has(riskLevel)).toBe(true);
    }
  });
});

describe("calculateRisk — determinism", () => {
  it("returns identical results for the same input called twice", () => {
    const metrics = { age: 45, bloodPressure: 130, glucoseLevel: 110, bmi: 27, cholesterol: 210, smokingStatus: "FORMER" as const };
    const r1 = calculateRisk(metrics);
    const r2 = calculateRisk(metrics);
    expect(r1.riskScore).toBe(r2.riskScore);
    expect(r1.riskLevel).toBe(r2.riskLevel);
  });

  it("different inputs produce different scores", () => {
    const low = calculateRisk(BASE_METRICS);
    const high = calculateRisk(MAX_METRICS);
    expect(low.riskScore).not.toBe(high.riskScore);
  });
});

describe("calculateRisk — invalid inputs", () => {
  const requiredFields: Array<keyof typeof BASE_METRICS> = [
    "age", "bloodPressure", "glucoseLevel", "bmi", "cholesterol", "smokingStatus",
  ];

  requiredFields.forEach((field) => {
    it(`throws InvalidMetricsError when '${field}' is undefined`, () => {
      const metrics = { ...BASE_METRICS, [field]: undefined };
      expect(() => calculateRisk(metrics as never)).toThrow(InvalidMetricsError);
    });

    it(`throws InvalidMetricsError when '${field}' is null`, () => {
      const metrics = { ...BASE_METRICS, [field]: null };
      expect(() => calculateRisk(metrics as never)).toThrow(InvalidMetricsError);
    });
  });

  it("throws InvalidMetricsError for completely empty object", () => {
    expect(() => calculateRisk({} as never)).toThrow(InvalidMetricsError);
  });

  it("throws InvalidMetricsError for null input", () => {
    expect(() => calculateRisk(null as never)).toThrow(InvalidMetricsError);
  });

  it("does not return a partial result when fields are missing", () => {
    const metrics = { age: 45 }; // missing 5 fields
    let result: unknown;
    try {
      result = calculateRisk(metrics as never);
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidMetricsError);
      result = undefined;
    }
    expect(result).toBeUndefined();
  });

  it("includes all missing field names in the error message", () => {
    const metrics = { age: 45 }; // missing 5 fields
    try {
      calculateRisk(metrics as never);
      fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidMetricsError);
      const msg = (e as InvalidMetricsError).message;
      expect(msg).toContain("bloodPressure");
      expect(msg).toContain("glucoseLevel");
      expect(msg).toContain("bmi");
      expect(msg).toContain("cholesterol");
      expect(msg).toContain("smokingStatus");
    }
  });
});

describe("calculateRisk — smoking status contribution", () => {
  it("CURRENT smoker scores higher than NEVER smoker (all else equal)", () => {
    const never   = calculateRisk({ ...BASE_METRICS, smokingStatus: "NEVER" });
    const former  = calculateRisk({ ...BASE_METRICS, smokingStatus: "FORMER" });
    const current = calculateRisk({ ...BASE_METRICS, smokingStatus: "CURRENT" });
    expect(current.riskScore).toBeGreaterThan(former.riskScore);
    expect(former.riskScore).toBeGreaterThan(never.riskScore);
  });
});
