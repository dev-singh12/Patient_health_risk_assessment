import { eq, and, isNull, desc, asc, count, sql } from "drizzle-orm";
import { db, DbTransaction } from "../config/db";
import { healthReports, riskAssessments } from "../db/schema";
import { HealthReport } from "../models/domain.types";

export interface CreateReportDto {
  assessmentId: string;
  summary: string;
  recommendations: string[];
}

export interface FindReportsOptions {
  page?: number;
  limit?: number;
  sortOrder?: "asc" | "desc";
}

export interface IReportRepository {
  create(data: CreateReportDto, tx?: DbTransaction): Promise<HealthReport>;
  findAllByPatientId(patientId: string, opts?: FindReportsOptions): Promise<{ rows: HealthReport[]; total: number }>;
  update(reportId: string, tx?: DbTransaction): Promise<HealthReport>;
}

const REPORT_COLUMNS = {
  reportId:        healthReports.reportId,
  assessmentId:    healthReports.assessmentId,
  summary:         healthReports.summary,
  recommendations: healthReports.recommendations,
  version:         healthReports.version,
  createdAt:       healthReports.createdAt,
  updatedAt:       healthReports.updatedAt,
};

export class ReportRepository implements IReportRepository {
  async create(data: CreateReportDto, tx?: DbTransaction): Promise<HealthReport> {
    const client = tx ?? db;
    const [row] = await client
      .insert(healthReports)
      .values({ assessmentId: data.assessmentId, summary: data.summary, recommendations: data.recommendations })
      .returning();
    return row as HealthReport;
  }

  async findAllByPatientId(
    patientId: string,
    opts: FindReportsOptions = {},
  ): Promise<{ rows: HealthReport[]; total: number }> {
    const { page = 1, limit = 20, sortOrder = "desc" } = opts;
    const offset = (page - 1) * limit;
    const orderFn = sortOrder === "asc" ? asc : desc;

    const baseWhere = and(
      eq(riskAssessments.patientId, patientId),
      isNull(riskAssessments.deletedAt),
    );

    const [rows, [{ value: total }]] = await Promise.all([
      db.select(REPORT_COLUMNS)
        .from(healthReports)
        .innerJoin(riskAssessments, eq(healthReports.assessmentId, riskAssessments.assessmentId))
        .where(baseWhere)
        .orderBy(orderFn(healthReports.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() })
        .from(healthReports)
        .innerJoin(riskAssessments, eq(healthReports.assessmentId, riskAssessments.assessmentId))
        .where(baseWhere),
    ]);

    return { rows: rows as HealthReport[], total: Number(total) };
  }

  async update(reportId: string, tx?: DbTransaction): Promise<HealthReport> {
    const client = tx ?? db;
    const [row] = await client
      .update(healthReports)
      .set({ version: sql`${healthReports.version} + 1`, updatedAt: new Date() })
      .where(eq(healthReports.reportId, reportId))
      .returning();
    return row as HealthReport;
  }
}
