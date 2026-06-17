import { bucket } from "./bucket";
import { dedupe } from "./dedupe";
import { hashImages } from "./hash";
import { ingest } from "./ingest";
import { score } from "./score";

/**
 * The full nightly pipeline. Each stage is independently runnable via the CLI;
 * order matters — hashes and buckets must exist before dedupe, and dedupe +
 * buckets before scoring (added in Phase 4).
 */
export async function runPipeline() {
  await ingest();
  await hashImages();
  await bucket();
  await dedupe();
  await score();
}
