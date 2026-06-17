import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Single postgres-js pool + Drizzle instance shared by the web app and worker.
 * Cached on globalThis so Next.js HMR (and repeated imports) don't open a new
 * pool on every reload. Works against the local PostGIS container and Neon.
 */
const globalForDb = globalThis as unknown as {
  __hunterSql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDb.__hunterSql ??
  postgres(env.DATABASE_URL, {
    max: env.DB_POOL_MAX,
    // postgres-js parses int8 (bigint) columns to JS string by default for
    // safety; Drizzle's bigint({mode}) handles the conversion per-column.
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__hunterSql = sql;
}

export const db = drizzle(sql, { schema });

export * from "@/db/schema";
