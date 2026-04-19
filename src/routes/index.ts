import { Router } from "express";
import { authRouter } from "../controllers/auth.controller";
import { patientRouter } from "../controllers/patient.controller";
import { clinicalDataRouter } from "../controllers/clinicalData.controller";
import { assessmentRunRouter, assessmentListRouter } from "../controllers/assessment.controller";
import { reportRouter } from "../controllers/report.controller";
import { healthRouter } from "../controllers/health.controller";
import { jobStatusRouter } from "../controllers/jobStatus.controller";

/**
 * Root router.
 *
 * All application routes are versioned under /api/v1.
 * Health and metrics endpoints are unversioned (infrastructure concerns).
 *
 * Endpoints:
 *   GET    /health
 *   GET    /health/metrics
 *
 *   POST   /api/v1/auth/login
 *   POST   /api/v1/auth/refresh
 *   POST   /api/v1/auth/logout
 *   POST   /api/v1/patients
 *   GET    /api/v1/patients/:id
 *   POST   /api/v1/clinical-data
 *   POST   /api/v1/assessment/run
 *   GET    /api/v1/assessments/:patientId   ?page&limit&sortOrder&status
 *   GET    /api/v1/reports/:patientId       ?page&limit&sortOrder
 *   GET    /api/v1/jobs/:jobId
 */
const router = Router();

// ── Infrastructure (unversioned) ──────────────────────────────────────────
router.use("/health", healthRouter);

// ── API v1 ────────────────────────────────────────────────────────────────
const v1 = Router();

v1.use("/auth",        authRouter);
v1.use("/patients",    patientRouter);
v1.use("/clinical-data", clinicalDataRouter);
v1.use("/assessment",  assessmentRunRouter);
v1.use("/assessments", assessmentListRouter);
v1.use("/reports",     reportRouter);
v1.use("/jobs",        jobStatusRouter);

router.use("/api/v1", v1);

export default router;
