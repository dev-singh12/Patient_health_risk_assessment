/**
 * Drizzle ORM schema — mirrors the original Prisma schema exactly.
 *
 * Tables: users, patients, clinical_data, risk_assessments, health_reports,
 *         refresh_tokens, idempotency_records
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  doublePrecision,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["HEALTHCARE_STAFF", "PATIENT"]);
export const assessmentStatusEnum = pgEnum("assessment_status", [
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);
export const riskLevelEnum = pgEnum("risk_level", [
  "LOW",
  "MODERATE",
  "HIGH",
  "CRITICAL",
]);
export const smokingStatusEnum = pgEnum("smoking_status", [
  "NEVER",
  "FORMER",
  "CURRENT",
]);

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    userId:    uuid("user_id").primaryKey().defaultRandom(),
    name:      text("name").notNull(),
    email:     text("email").notNull().unique(),
    password:  text("password").notNull(),
    role:      roleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("users_email_idx").on(t.email)],
);

// ---------------------------------------------------------------------------
// patients
// ---------------------------------------------------------------------------

export const patients = pgTable(
  "patients",
  {
    patientId:     uuid("patient_id").primaryKey().defaultRandom(),
    userId:        uuid("user_id").notNull().unique().references(() => users.userId, { onDelete: "cascade" }),
    age:           integer("age").notNull(),
    medicalHistory: text("medical_history").notNull(),
    createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt:     timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("patients_user_id_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// clinical_data
// ---------------------------------------------------------------------------

export const clinicalData = pgTable(
  "clinical_data",
  {
    clinicalId: uuid("clinical_id").primaryKey().defaultRandom(),
    patientId:  uuid("patient_id").notNull().references(() => patients.patientId, { onDelete: "cascade" }),
    metrics:    jsonb("metrics").notNull(),
    createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("clinical_data_patient_id_idx").on(t.patientId),
    index("clinical_data_created_at_idx").on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// risk_assessments
// ---------------------------------------------------------------------------

export const riskAssessments = pgTable(
  "risk_assessments",
  {
    assessmentId: uuid("assessment_id").primaryKey().defaultRandom(),
    patientId:    uuid("patient_id").notNull().references(() => patients.patientId, { onDelete: "cascade" }),
    riskScore:    doublePrecision("risk_score").notNull(),
    riskLevel:    riskLevelEnum("risk_level").notNull(),
    status:       assessmentStatusEnum("status").notNull().default("PROCESSING"),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt:    timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("risk_assessments_patient_id_idx").on(t.patientId),
    index("risk_assessments_created_at_idx").on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// health_reports
// ---------------------------------------------------------------------------

export const healthReports = pgTable(
  "health_reports",
  {
    reportId:       uuid("report_id").primaryKey().defaultRandom(),
    assessmentId:   uuid("assessment_id").notNull().unique().references(() => riskAssessments.assessmentId, { onDelete: "cascade" }),
    summary:        text("summary").notNull(),
    recommendations: text("recommendations").array().notNull(),
    version:        integer("version").notNull().default(1),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("health_reports_assessment_id_idx").on(t.assessmentId)],
);

// ---------------------------------------------------------------------------
// refresh_tokens
// ---------------------------------------------------------------------------

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    tokenId:   uuid("token_id").primaryKey().defaultRandom(),
    userId:    uuid("user_id").notNull(),
    familyId:  uuid("family_id").notNull(),
    token:     text("token").notNull().unique(),
    usedAt:    timestamp("used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("refresh_tokens_user_id_idx").on(t.userId),
    index("refresh_tokens_family_id_idx").on(t.familyId),
  ],
);

// ---------------------------------------------------------------------------
// idempotency_records
// ---------------------------------------------------------------------------

export const idempotencyRecords = pgTable("idempotency_records", {
  key:       text("key").primaryKey(),
  status:    text("status").notNull(), // "in_flight" | "complete" | "failed"
  result:    jsonb("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Inferred row types
// ---------------------------------------------------------------------------

export type UserRow           = typeof users.$inferSelect;
export type PatientRow        = typeof patients.$inferSelect;
export type ClinicalDataRow   = typeof clinicalData.$inferSelect;
export type RiskAssessmentRow = typeof riskAssessments.$inferSelect;
export type HealthReportRow   = typeof healthReports.$inferSelect;
export type RefreshTokenRow   = typeof refreshTokens.$inferSelect;
