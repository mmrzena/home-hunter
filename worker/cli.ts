import { sql } from "@/db";

import { bucket } from "./pipeline/bucket";
import { dedupe } from "./pipeline/dedupe";
import { hashImages } from "./pipeline/hash";
import { ingest } from "./pipeline/ingest";
import { runPipeline } from "./pipeline/run";
import { score } from "./pipeline/score";

const COMMANDS: Record<string, () => Promise<unknown>> = {
  ingest,
  hash: hashImages,
  bucket,
  dedupe,
  score,
  pipeline: runPipeline,
};

async function main() {
  const command = process.argv[2];
  const run = command ? COMMANDS[command] : undefined;
  if (!run) {
    console.error(
      `usage: tsx worker/cli.ts <command>\n  commands: ${Object.keys(COMMANDS).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }
  await run();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
