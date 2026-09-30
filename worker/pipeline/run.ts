import { sql } from "@/db";
import { runBatch } from "../durable/run-batch";
import { getOrCreateRun } from "../durable/run-record";

/** The CLI and Vercel use the same checkpoints, batch limits, and retry-safe writes. */
export async function runPipeline() {
  const run = await sql.begin((tx) => getOrCreateRun(tx, null));
  console.log(`pipeline ${run.id}: starting / resuming at ${run.state.phase}`);
  while (true) {
    const progress = await runBatch(run.id);
    console.log(`pipeline ${run.id}:`, progress);
    if (progress.done) return progress;
  }
}
