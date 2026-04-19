import { eq, and, isNull } from "drizzle-orm";
import { db, DbTransaction } from "../config/db";
import { patients, clinicalData, riskAssessments } from "../db/schema";
import { Patient } from "../models/domain.types";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreatePatientDto {
  userId: string;
  age: number;
  medicalHistory: string;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IPatientRepository {
  create(data: CreatePatientDto, tx?: DbTransaction): Promise<Patient>;
  findById(id: string): Promise<Patient | null>;
  softDelete(id: string, tx?: DbTransaction): Promise<void>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class PatientRepository implements IPatientRepository {
  async create(data: CreatePatientDto, tx?: DbTransaction): Promise<Patient> {
    const client = tx ?? db;
    const [row] = await client
      .insert(patients)
      .values({
        userId: data.userId,
        age: data.age,
        medicalHistory: data.medicalHistory,
      })
      .returning();
    return row as Patient;
  }

  async findById(id: string): Promise<Patient | null> {
    const [row] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.patientId, id), isNull(patients.deletedAt)))
      .limit(1);
    return (row as Patient) ?? null;
  }

  /**
   * Soft-deletes the patient and cascades to ClinicalData and RiskAssessment
   * within the same transaction.
   */
  async softDelete(id: string, tx?: DbTransaction): Promise<void> {
    const now = new Date();

    const run = async (client: DbTransaction) => {
      await client
        .update(clinicalData)
        .set({ deletedAt: now })
        .where(and(eq(clinicalData.patientId, id), isNull(clinicalData.deletedAt)));

      await client
        .update(riskAssessments)
        .set({ deletedAt: now })
        .where(and(eq(riskAssessments.patientId, id), isNull(riskAssessments.deletedAt)));

      await client
        .update(patients)
        .set({ deletedAt: now })
        .where(eq(patients.patientId, id));
    };

    if (tx) {
      await run(tx);
    } else {
      await db.transaction(run);
    }
  }
}
