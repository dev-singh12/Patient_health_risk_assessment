import { eq, and, isNull } from "drizzle-orm";
import { db, DbTransaction } from "../config/db";
import { users } from "../db/schema";
import { User } from "../models/domain.types";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: "HEALTHCARE_STAFF" | "PATIENT";
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IUserRepository {
  create(data: CreateUserDto, tx?: DbTransaction): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  softDelete(id: string, tx?: DbTransaction): Promise<void>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class UserRepository implements IUserRepository {
  async create(data: CreateUserDto, tx?: DbTransaction): Promise<User> {
    const client = tx ?? db;
    const [row] = await client
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
      })
      .returning();
    return row as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return (row as User) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.userId, id), isNull(users.deletedAt)))
      .limit(1);
    return (row as User) ?? null;
  }

  async softDelete(id: string, tx?: DbTransaction): Promise<void> {
    const client = tx ?? db;
    await client
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.userId, id));
  }
}
