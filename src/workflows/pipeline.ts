import { processPipelineBatch } from "./pipeline-step";

export async function pipelineWorkflow(runId: string) {
  "use workflow";
  while (true) {
    const progress = await processPipelineBatch(runId);
    if (progress.done) return progress;
  }
}
