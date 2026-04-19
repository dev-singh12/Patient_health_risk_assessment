import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbac } from "../middleware/rbac.middleware";
import { validate } from "../middleware/validate.middleware";
import { auditLog } from "../middleware/auditLog.middleware";
import { CreatePatientSchema } from "../dtos/patient.dto";
import { UserRepository } from "../repositories/user.repository";
import { PatientRepository } from "../repositories/patient.repository";
import { db } from "../config/db";
import { AuthorizationError, ConflictError, NotFoundError } from "../errors";

const userRepo = new UserRepository();
const patientRepo = new PatientRepository();
const BCRYPT_SALT_ROUNDS = 10;

export const patientRouter = Router();

/**
 * POST /patients
 * Creates a User + Patient in a single transaction.
 */
patientRouter.post(
  "/",
  authMiddleware,
  rbac("HEALTHCARE_STAFF"),
  validate(CreatePatientSchema),
  auditLog("CREATE_PATIENT"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, password, age, medicalHistory } = req.body;
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

      const patient = await db.transaction(async (tx) => {
        let user: { userId: string };
        try {
          user = await userRepo.create({ name, email, password: hashedPassword, role: "PATIENT" }, tx);
        } catch (err: unknown) {
          if (
            err instanceof Error &&
            "code" in err &&
            (err as NodeJS.ErrnoException).code === "23505"
          ) {
            throw new ConflictError("Email already in use");
          }
          throw err;
        }
        return patientRepo.create({ userId: user.userId, age, medicalHistory }, tx);
      });

      res.status(201).json({
        patientId: patient.patientId,
        userId: patient.userId,
        age: patient.age,
        medicalHistory: patient.medicalHistory,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /patients/:id
 */
patientRouter.get(
  "/:id",
  authMiddleware,
  auditLog("READ_PATIENT"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const requestingUser = req.user!;

      const patient = await patientRepo.findById(id);
      if (!patient) throw new NotFoundError("Patient");

      if (requestingUser.role === "PATIENT" && patient.userId !== requestingUser.userId) {
        throw new AuthorizationError("Insufficient permissions");
      }

      res.status(200).json({
        patientId: patient.patientId,
        userId: patient.userId,
        age: patient.age,
        medicalHistory: patient.medicalHistory,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
      });
    } catch (err) {
      next(err);
    }
  },
);
