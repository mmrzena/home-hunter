import { sql } from "@/db";
import { isCronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request, process.env.CRON_SECRET))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const runs =
    await sql`SELECT id, day, started_at, updated_at, finished_at, workflow_id, error,
    state - 'pageItems' AS progress FROM pipeline_runs ORDER BY started_at DESC LIMIT 10`;
  return Response.json({ runs }, { headers: { "Cache-Control": "no-store" } });
}
