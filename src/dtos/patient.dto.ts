import { z } from "zod";

// ---------------------------------------------------------------------------
// Patient request schemas
// ---------------------------------------------------------------------------

export const CreatePatientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  age: z.number().int().positive(),
  medicalHistory: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Patient response schema
// ---------------------------------------------------------------------------

export const PatientResponseSchema = z.object({
  patientId: z.string().uuid(),
  userId: z.string().uuid(),
  age: z.number().int().positive(),
  medicalHistory: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type CreatePatientDto = z.infer<typeof CreatePatientSchema>;
export type PatientResponseDto = z.infer<typeof PatientResponseSchema>;
