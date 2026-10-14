import type { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSessionUserId } from "@/lib/session";

/**
 * The pipeline routes answer to Vercel Cron (bearer `CRON_SECRET`) and to the
 * allowlisted user signed in through the browser, so run history and a manual
 * kick are a URL away when the free plan's 30-minute logs have gone.
 */
export async function isPipelineAuthorized(
  request: NextRequest,
): Promise<boolean> {
  if (isCronAuthorized(request, process.env.CRON_SECRET)) return true;
  return (await getSessionUserId(request)) !== null;
}
