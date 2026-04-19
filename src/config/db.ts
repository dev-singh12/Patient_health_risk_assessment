import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { env } from "./env";

/**
 * Singleton postgres.js connection pool.
 * postgres-js manages the pool internally; one instance per process is enough.
 */
const globalForDb = globalThis as unknown as {
  pgClient: postgres.Sql | undefined;
};

const pgClient: postgres.Sql =
  globalForDb.pgClient ?? postgres(env.DATABASE_URL, { max: 10 });

if (env.NODE_ENV !== "production") {
  globalForDb.pgClient = pgClient;
}

/**
 * Drizzle ORM instance — the single DB entry point for the whole application.
 */
export const db = drizzle(pgClient, { schema });

/**
 * DbTransaction type — the transaction client passed to repository methods
 * that participate in an orchestrator-level database transaction.
 *
 * Drizzle's transaction callback receives a `tx` that has the same API as `db`.
 */
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export default db;
