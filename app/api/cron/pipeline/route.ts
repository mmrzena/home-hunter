import { getRun, start } from "workflow/api";
import { sql } from "@/db";
import { isCronAuthorized } from "@/lib/cron-auth";
import { pipelineWorkflow } from "@/workflows/pipeline";
import { getOrCreateRun } from "../../../../worker/durable/run-record";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request, process.env.CRON_SECRET))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await sql.begin(async (tx) => {
      await tx`SET LOCAL lock_timeout = '5s'`;
      const run = await getOrCreateRun(
        tx,
        new Date().toISOString().slice(0, 10),
      );
      if (run.finishedAt) return { runId: run.id, status: "completed" };
      if (run.workflowId) {
        const workflow = getRun(run.workflowId);
        if (await workflow.exists) {
          const status = await workflow.status;
          if (["pending", "running", "workflow_suspended"].includes(status))
            return { runId: run.id, workflowId: run.workflowId, status };
        }
      }
      // Enqueue while holding the trigger lock. Workflows only return tiny progress objects;
      // listing payloads and committed cursors stay in Postgres across SDK retention windows.
      const workflow = await start(pipelineWorkflow, [run.id]);
      await tx`UPDATE pipeline_runs SET workflow_id = ${workflow.runId}, error = NULL WHERE id = ${run.id}`;
      return { runId: run.id, workflowId: workflow.runId, status: "started" };
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(
      "Pipeline trigger failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      {
        error:
          "Pipeline could not be started. Check the server logs and database migrations.",
      },
      { status: 503 },
    );
  }
}
