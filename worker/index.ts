import cron from "node-cron";

import { runPipeline } from "./pipeline/run";

/**
 * Worker daemon: runs the full pipeline once on boot, then daily at 06:00.
 * House-hunting is a daily activity, not a real-time one — low cadence keeps us
 * gentle on the source APIs. Run individual stages on demand via worker/cli.ts.
 */
const SCHEDULE = "0 6 * * *";

async function safeRun(trigger: string) {
  console.log(`[${trigger}] pipeline starting`);
  try {
    await runPipeline();
  } catch (error) {
    console.error(`[${trigger}] pipeline failed:`, error);
  }
}

cron.schedule(SCHEDULE, () => safeRun("cron"));
console.log(`worker up — pipeline scheduled daily at 06:00 (${SCHEDULE})`);
void safeRun("boot");
