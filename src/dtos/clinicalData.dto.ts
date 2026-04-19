import { z } from "zod";

// ---------------------------------------------------------------------------
// Prisma enum values replicated as Zod enum (avoids importing @prisma/client)
// ---------------------------------------------------------------------------

const SmokingStatusEnum = z.enum(["NEVER", "FORMER", "CURRENT"]);

// ---------------------------------------------------------------------------
// Clinical data request schemas
// ---------------------------------------------------------------------------

export const ClinicalMetricsSchema = z.object({
  age: z.number().int().positive(),
  bloodPressure: z.number().positive(),
  glucoseLevel: z.number().positive(),
  bmi: z.number().positive(),
  cholesterol: z.number().positive(),
  smokingStatus: SmokingStatusEnum,
});

export const CreateClinicalDataSchema = z.object({
  patientId: z.string().uuid(),
  metrics: ClinicalMetricsSchema,
});

// ---------------------------------------------------------------------------
// Clinical data response schema
// ---------------------------------------------------------------------------

export const ClinicalDataResponseSchema = z.object({
  clinicalId: z.string().uuid(),
  patientId: z.string().uuid(),
  metrics: ClinicalMetricsSchema,
  createdAt: z.date(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type ClinicalMetricsDto = z.infer<typeof ClinicalMetricsSchema>;
export type CreateClinicalDataDto = z.infer<typeof CreateClinicalDataSchema>;
export type ClinicalDataResponseDto = z.infer<typeof ClinicalDataResponseSchema>;
