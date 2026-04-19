import { z } from "zod";

// ---------------------------------------------------------------------------
// Prisma enum values replicated as Zod enums (avoids importing @prisma/client)
// ---------------------------------------------------------------------------

const RiskLevelEnum = z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]);
const AssessmentStatusEnum = z.enum(["PROCESSING", "COMPLETED", "FAILED"]);

// ---------------------------------------------------------------------------
// Assessment request schemas
// ---------------------------------------------------------------------------

export const RunAssessmentSchema = z.object({
  patientId: z.string().uuid(),
  idempotencyKey: z.string().min(1).max(255),
});

// ---------------------------------------------------------------------------
// Assessment response schemas
// ---------------------------------------------------------------------------

export const AssessmentResponseSchema = z.object({
  assessmentId: z.string().uuid(),
  patientId: z.string().uuid(),
  riskScore: z.number().min(0).max(100),
  riskLevel: RiskLevelEnum,
  status: AssessmentStatusEnum,
  createdAt: z.date(),
});

export const AssessmentResultSchema = z.object({
  assessmentId: z.string().uuid(),
  patientId: z.string().uuid(),
  riskScore: z.number().min(0).max(100),
  riskLevel: RiskLevelEnum,
  status: AssessmentStatusEnum,
  report: z.object({
    reportId: z.string().uuid(),
    summary: z.string(),
    recommendations: z.array(z.string()),
    version: z.number().int().positive(),
  }),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type RunAssessmentDto = z.infer<typeof RunAssessmentSchema>;
export type AssessmentResponseDto = z.infer<typeof AssessmentResponseSchema>;
export type AssessmentResultDto = z.infer<typeof AssessmentResultSchema>;
