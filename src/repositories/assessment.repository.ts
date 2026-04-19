import { eq, and, isNull, desc, asc, count } from "drizzle-orm";
import { db, DbTransaction } from "../config/db";
import { riskAssessments } from "../db/schema";
import { RiskAssessment, RiskLevel, AssessmentStatus } from "../models/domain.types";

export interface CreateAssessmentDto {
  patientId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  status: AssessmentStatus;
}

export interface FindAssessmentsOptions {
  page?: number;
  limit?: number;
  sortOrder?: "asc" | "desc";
  status?: AssessmentStatus;
}

export interface IAssessmentRepository {
  create(data: CreateAssessmentDto, tx?: DbTransaction): Promise<RiskAssessment>;
  updateStatus(id: string, status: AssessmentStatus, tx?: DbTransaction): Promise<void>;
  findAllByPatientId(patientId: string, opts?: FindAssessmentsOptions): Promise<{ rows: RiskAssessment[]; total: number }>;
}

export class AssessmentRepository implements IAssessmentRepository {
  async create(data: CreateAssessmentDto, tx?: DbTransaction): Promise<RiskAssessment> {
    const client = tx ?? db;
    const [row] = await client
      .insert(riskAssessments)
      .values({ patientId: data.patientId, riskScore: data.riskScore, riskLevel: data.riskLevel, status: data.status })
      .returning();
    return row as RiskAssessment;
  }

  async updateStatus(id: string, status: AssessmentStatus, tx?: DbTransaction): Promise<void> {
    const client = tx ?? db;
    await client
      .update(riskAssessments)
      .set({ status, updatedAt: new Date() })
      .where(eq(riskAssessments.assessmentId, id));
  }

  async findAllByPatientId(
    patientId: string,
    opts: FindAssessmentsOptions = {},
  ): Promise<{ rows: RiskAssessment[]; total: number }> {
    const { page = 1, limit = 20, sortOrder = "desc", status } = opts;
    const offset = (page - 1) * limit;

    const baseWhere = and(
      eq(riskAssessments.patientId, patientId),
      isNull(riskAssessments.deletedAt),
      status ? eq(riskAssessments.status, status) : undefined,
    );

    const orderFn = sortOrder === "asc" ? asc : desc;

    const [rows, [{ value: total }]] = await Promise.all([
      db.select({
        assessmentId: riskAssessments.assessmentId,
        patientId:    riskAssessments.patientId,
        riskScore:    riskAssessments.riskScore,
        riskLevel:    riskAssessments.riskLevel,
        status:       riskAssessments.status,
        createdAt:    riskAssessments.createdAt,
        updatedAt:    riskAssessments.updatedAt,
        deletedAt:    riskAssessments.deletedAt,
      })
        .from(riskAssessments)
        .where(baseWhere)
        .orderBy(orderFn(riskAssessments.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(riskAssessments).where(baseWhere),
    ]);

    return { rows: rows as RiskAssessment[], total: Number(total) };
  }
}
