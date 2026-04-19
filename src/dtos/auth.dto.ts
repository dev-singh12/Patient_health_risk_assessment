import { z } from "zod";

// ---------------------------------------------------------------------------
// Prisma enum values replicated as Zod enums (avoids importing @prisma/client)
// ---------------------------------------------------------------------------

const RoleEnum = z.enum(["HEALTHCARE_STAFF", "PATIENT"]);

// ---------------------------------------------------------------------------
// Auth request schemas
// ---------------------------------------------------------------------------

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  age: z.number().int().positive(),
  medicalHistory: z.string().min(1),
});

export const RefreshSchema = z.object({
  refreshToken: z.string(),
});

export const LogoutSchema = z.object({
  refreshToken: z.string(),
});

// ---------------------------------------------------------------------------
// Auth response schema
// ---------------------------------------------------------------------------

export const AuthResultSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    userId: z.string(),
    name: z.string(),
    role: RoleEnum,
  }),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type LoginDto = z.infer<typeof LoginSchema>;
export type RegisterDto = z.infer<typeof RegisterSchema>;
export type RefreshDto = z.infer<typeof RefreshSchema>;
export type LogoutDto = z.infer<typeof LogoutSchema>;
export type AuthResultDto = z.infer<typeof AuthResultSchema>;
