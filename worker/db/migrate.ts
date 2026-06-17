import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

import { env } from "@/lib/env";

/**
 * Applies any not-yet-run *.sql files in src/db/migrations in lexical order.
 * Each file runs as a single simple-protocol query, which Postgres executes in
 * one implicit transaction — so a file is atomic. The schema_migrations insert
 * is appended to the same batch, keeping "ran" and "recorded" in lockstep.
 */
const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/db/migrations",
);

async function main() {
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  try {
    await sql
      .unsafe(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `)
      .simple();

    const applied = new Set(
      (await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map(
        (row) => row.name,
      ),
    );

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const content = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      console.log(`applying ${file}…`);
      await sql
        .unsafe(
          `${content}\nINSERT INTO schema_migrations (name) VALUES ('${file}');`,
        )
        .simple();
      ran += 1;
    }

    console.log(
      ran === 0 ? "already up to date" : `applied ${ran} migration(s)`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
