import { runBatch } from "../../worker/durable/run-batch";

export async function processPipelineBatch(runId: string) {
  "use step";
  return runBatch(runId);
}

processPipelineBatch.maxRetries = 3;
