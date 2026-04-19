import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbac } from "../middleware/rbac.middleware";
import { validate } from "../middleware/validate.middleware";
import { auditLog } from "../middleware/auditLog.middleware";
import { CreateClinicalDataSchema } from "../dtos/clinicalData.dto";
import { ClinicalDataRepository } from "../repositories/clinicalData.repository";
import { PatientRepository } from "../repositories/patient.repository";
import { NotFoundError } from "../errors";

// ---------------------------------------------------------------------------
// Singleton repository instances
// ---------------------------------------------------------------------------

const clinicalDataRepo = new ClinicalDataRepository();
const patientRepo = new PatientRepository();

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const clinicalDataRouter = Router();

/**
 * POST /clinical-data
 *
 * Creates a ClinicalData record linked to an existing patient.
 * Only HEALTHCARE_STAFF may call this endpoint.
 * Returns HTTP 404 if the referenced patient does not exist or is soft-deleted.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 2.4, 10.1
 */
clinicalDataRouter.post(
  "/",
  authMiddleware,
  rbac("HEALTHCARE_STAFF"),
  validate(CreateClinicalDataSchema),
  auditLog("CREATE_CLINICAL_DATA"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId, metrics } = req.body;

      // Verify the patient exists and is not soft-deleted
      const patient = await patientRepo.findById(patientId);
      if (!patient) {
        throw new NotFoundError("Patient");
      }

      const clinicalData = await clinicalDataRepo.create({ patientId, metrics });

      res.status(201).json({
        clinicalId: clinicalData.clinicalId,
        patientId: clinicalData.patientId,
        metrics: clinicalData.metrics,
        createdAt: clinicalData.createdAt,
      });
    } catch (err) {
      next(err);
    }
  },
);
