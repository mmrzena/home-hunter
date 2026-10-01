import type { Sql } from "postgres";
import { sql as defaultSql } from "@/db";
import { withHttpBudget } from "../lib/http";
import { score } from "../pipeline/score";
import { ingestBatch } from "./ingest-batch";
import { landIngestBatch, landPriceBatch } from "./land-batch";
import {
  bucketBatch,
  edgeBatch,
  hashBatch,
  publishClusters,
} from "./process-batch";
import { nextPhase, type PipelineState } from "./state";

export type BatchProgress = {
  phase: PipelineState["phase"];
  seen: number;
  scored: number;
  done: boolean;
};

export async function runBatch(
  runId: string,
  database: Sql = defaultSql,
): Promise<BatchProgress> {
  try {
    return await withHttpBudget(() =>
      database.begin(async (sql) => {
        await sql`SET LOCAL statement_timeout = '25s'`;
        await sql`SET LOCAL lock_timeout = '5s'`;
        const [run] = await sql<{ state: PipelineState; startedAt: string }[]>`
        SELECT state, started_at AS "startedAt" FROM pipeline_runs WHERE id = ${runId} FOR UPDATE
      `;
        if (!run) throw new Error("Pipeline run not found");
        const state = run.state;
        switch (state.phase) {
          case "ingest":
            await ingestBatch(sql, state, run.startedAt);
            break;
          case "landIngest":
            await landIngestBatch(sql, state, run.startedAt);
            break;
          case "hash":
            await hashBatch(sql, state);
            break;
          case "bucket":
            await bucketBatch(sql, state);
            break;
          case "landPrice":
            await landPriceBatch(sql, state);
            break;
          case "edges":
            await edgeBatch(sql, state, runId);
            break;
          case "clusters":
            await publishClusters(sql, state, runId);
            break;
          case "score": {
            const result = await score(sql, state.cursor, 200);
            state.cursor = result.lastId;
            state.scored += result.scored;
            if (result.scored === 0) nextPhase(state, "done");
            break;
          }
          case "done":
            break;
        }
        await sql`UPDATE pipeline_runs SET state = ${JSON.stringify(state)}::jsonb, updated_at = now(), error = NULL,
        finished_at = CASE WHEN ${state.phase === "done"} THEN coalesce(finished_at, now()) ELSE NULL END WHERE id = ${runId}`;
        return {
          phase: state.phase,
          seen: state.seen,
          scored: state.scored,
          done: state.phase === "done",
        };
      }),
    );
  } catch (error) {
    // Work and its checkpoint rolled back together. A retry resumes the same batch.
    const message =
      error instanceof Error ? error.message : "Unknown pipeline error";
    await database`UPDATE pipeline_runs SET error = ${message.slice(0, 1000)}, updated_at = now() WHERE id = ${runId}`;
    throw error;
  }
}
