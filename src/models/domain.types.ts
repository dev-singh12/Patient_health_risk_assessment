/**
 * Domain types for the Patient Health Risk Assessment System.
 *
 * These types are defined independently of Prisma to keep the domain layer
 * decoupled from the ORM. They mirror the Prisma schema but are plain
 * TypeScript interfaces and type aliases.
 */

// Re-export DbTransaction so the rest of the codebase imports it from here
export type { DbTransaction } from "../config/db";

// ---------------------------------------------------------------------------
// Enums (mirrored from Prisma schema as TypeScript union types)
// ---------------------------------------------------------------------------

export type Role = "HEALTHCARE_STAFF" | "PATIENT";

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type AssessmentStatus = "PROCESSING" | "COMPLETED" | "FAILED";

export type SmokingStatus = "NEVER" | "FORMER" | "CURRENT";

// ---------------------------------------------------------------------------
// Core domain interfaces
// ---------------------------------------------------------------------------

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
// Domain entity types (mirror Prisma models without ORM coupling)
// ---------------------------------------------------------------------------

export interface User {
  userId: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Patient {
  patientId: string;
  userId: string;
  age: number;
  medicalHistory: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ClinicalData {
  clinicalId: string;
  patientId: string;
  metrics: ClinicalMetrics;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface RiskAssessment {
  assessmentId: string;
  patientId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  status: AssessmentStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface HealthReport {
  reportId: string;
  assessmentId: string;
  summary: string;
  recommendations: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshToken {
  tokenId: string;
  userId: string;
  familyId: string;
  token: string;
  usedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface IdempotencyRecord {
  key: string;
  status: "in_flight" | "complete" | "failed";
  result: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}
