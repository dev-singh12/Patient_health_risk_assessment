import { eq, and, isNull, desc } from "drizzle-orm";
import { db, DbTransaction } from "../config/db";
import { clinicalData } from "../db/schema";
import { ClinicalData, ClinicalMetrics } from "../models/domain.types";

export interface CreateClinicalDataDto {
  patientId: string;
  metrics: ClinicalMetrics;
}

export interface IClinicalDataRepository {
  create(data: CreateClinicalDataDto, tx?: DbTransaction): Promise<ClinicalData>;
  findLatestByPatientId(patientId: string, tx?: DbTransaction): Promise<ClinicalData | null>;
  findAllByPatientId(patientId: string, tx?: DbTransaction): Promise<ClinicalData[]>;
}

function toEntity(row: typeof clinicalData.$inferSelect): ClinicalData {
  return { ...row, metrics: row.metrics as unknown as ClinicalMetrics };
}

export class ClinicalDataRepository implements IClinicalDataRepository {
  async create(data: CreateClinicalDataDto, tx?: DbTransaction): Promise<ClinicalData> {
    const client = tx ?? db;
    const [row] = await client
      .insert(clinicalData)
      .values({ patientId: data.patientId, metrics: data.metrics as unknown as Record<string, unknown> })
      .returning();
    return toEntity(row);
  }

  async findLatestByPatientId(patientId: string, tx?: DbTransaction): Promise<ClinicalData | null> {
    const client = tx ?? db;
    const [row] = await client
      .select()
      .from(clinicalData)
      .where(and(eq(clinicalData.patientId, patientId), isNull(clinicalData.deletedAt)))
      .orderBy(desc(clinicalData.createdAt))
      .limit(1);
    return row ? toEntity(row) : null;
  }

  async findAllByPatientId(patientId: string, tx?: DbTransaction): Promise<ClinicalData[]> {
    const client = tx ?? db;
    const rows = await client
      .select()
      .from(clinicalData)
      .where(and(eq(clinicalData.patientId, patientId), isNull(clinicalData.deletedAt)))
      .orderBy(desc(clinicalData.createdAt));
    return rows.map(toEntity);
  }
}
