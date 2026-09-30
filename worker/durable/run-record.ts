import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { env } from "@/lib/env";
import { type IngestSource, initialState, type PipelineState } from "./state";

export type PipelineRun = {
  id: string;
  workflowId: string | null;
  finishedAt: string | null;
  state: PipelineState;
};

/** Serializes daily triggers and CLI starts. The DB also enforces one unfinished run. */
export async function getOrCreateRun(
  sql: TransactionSql,
  day: string | null,
): Promise<PipelineRun> {
  await sql`SELECT pg_advisory_xact_lock(7184291)`;
  const [existing] = await sql<
    PipelineRun[]
  >`SELECT id, workflow_id AS "workflowId", finished_at AS "finishedAt", state
    FROM pipeline_runs WHERE finished_at IS NULL OR day = ${day}::date
    ORDER BY (finished_at IS NULL) DESC, started_at DESC LIMIT 1`;
  if (existing) return existing;
  const sources: IngestSource[] = ["sreality"];
  if (env.ENABLE_BEZREALITKY) sources.push("bezrealitky");
  if (env.ENABLE_CESKEREALITY) sources.push("ceskereality");
  const id = randomUUID();
  const state = initialState(sources, env.INGEST_MAX_PAGES);
  await sql`INSERT INTO pipeline_runs (id, day, state) VALUES (${id}, ${day}, ${JSON.stringify(state)}::jsonb)`;
  return { id, workflowId: null, finishedAt: null, state };
}
