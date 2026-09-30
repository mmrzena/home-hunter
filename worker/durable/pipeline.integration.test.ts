import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { runBatch } from "./run-batch";
import { getOrCreateRun } from "./run-record";
import { initialState, type PipelineState } from "./state";

const TEST_URL = process.env.PIPELINE_TEST_DATABASE_URL;

test("durable pipeline commits checkpoints atomically and resumes safely", {
  skip: !TEST_URL,
}, async (context) => {
  const schema = `pipeline_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(TEST_URL ?? "", { max: 1 });
  await admin.unsafe(`CREATE SCHEMA ${schema}`);
  const sql = postgres(TEST_URL ?? "", {
    max: 4,
    connection: { search_path: `${schema},public` },
  });
  // Match the shared @/db pool, whose drizzle wrapper makes jsonb and timestamp
  // (de)serialization pass-through.
  drizzle(sql);
  try {
    for (const migration of ["0001_init.sql", "0004_durable_pipeline.sql"]) {
      const content = await readFile(
        new URL(`../../src/db/migrations/${migration}`, import.meta.url),
        "utf8",
      );
      await sql.unsafe(content).simple();
    }
    const old = await sql<{ id: number }[]>`INSERT INTO listings
      (source, source_id, price, usable_area_m2, land_area_m2, lat, lng, property_kind, last_seen_at)
      VALUES ('sreality', '101', 8000000, 120, 600, 50.1, 14.4, 'rodinny_dum', now() - interval '10 days'),
             ('sreality', '102', 8000000, 120, 600, 50.1, 14.4, 'rodinny_dum', now() - interval '10 days'),
             ('sreality', 'gone', 8000000, 120, 600, 50.1, 14.4, 'rodinny_dum', now() - interval '10 days') RETURNING id::int`;
    await sql`INSERT INTO listing_image_hashes (listing_id, position, url, dhash)
      VALUES (${old[0].id}, 0, 'https://example.com/one.jpg', 1), (${old[1].id}, 0, 'https://example.com/two.jpg', 1)`;
    const runId = randomUUID();
    await sql`INSERT INTO pipeline_runs (id, day, state) VALUES (${runId}, current_date, ${JSON.stringify(initialState(["sreality"], 2))}::jsonb)`;
    const starts = await Promise.all([
      sql.begin((tx) => getOrCreateRun(tx, null)),
      sql.begin((tx) => getOrCreateRun(tx, null)),
    ]);
    assert.deepEqual(
      starts.map((run) => run.id),
      [runId, runId],
    );
    let shouldFail = true;
    context.mock.method(globalThis, "fetch", async (url: string) => {
      if (url.includes("/search?")) {
        const region = new URL(url).searchParams.get("locality_region_id");
        return Response.json({
          results: [
            {
              hash_id: region === "10" ? 101 : 102,
              advert_name: "Prodej rodinného domu 120 m²",
              price_czk: 9000000,
              locality: { gps_lat: 50.1, gps_lon: 14.4, city: "Test town" },
            },
          ],
          pagination: { total: 1 },
        });
      }
      if (shouldFail) return new Response("temporary failure", { status: 503 });
      return Response.json({
        result: {
          hash_id: url.endsWith("101") ? 101 : 102,
          advert_name: "Prodej rodinného domu",
          price_czk: 9000000,
          usable_area: 120,
          estate_area: 600,
          locality: { gps_lat: 50.1, gps_lon: 14.4, city: "Test town" },
          advert_description: "A house.",
        },
      });
    });
    await runBatch(runId, sql); // fetched page, no listing writes yet
    await assert.rejects(runBatch(runId, sql));
    const [failed] = await sql<
      { state: PipelineState; error: string }[]
    >`SELECT state, error FROM pipeline_runs WHERE id = ${runId}`;
    assert.equal(failed.state.itemIndex, 0);
    assert.match(failed.error, /503/);
    assert.equal((await sql`SELECT * FROM price_history`).length, 0);
    shouldFail = false;
    let done = false;
    for (let index = 0; index < 30; index++) {
      const progress = await runBatch(runId, sql);
      if (progress.done) {
        done = true;
        break;
      }
    }
    assert.equal(done, true);
    const history = await sql`SELECT * FROM price_history`;
    assert.equal(history.length, 2);
    await runBatch(runId, sql); // at-least-once delivery after completion is a no-op
    assert.equal((await sql`SELECT * FROM price_history`).length, 2);
    const active = await sql`SELECT * FROM listings WHERE is_active`;
    assert.equal(active.length, 2);
    assert.equal(active[0].cluster_id, active[1].cluster_id);
    assert.ok(active.every((row) => row.scored_at !== null));
    assert.equal((await sql`SELECT * FROM clusters`).length, 1);
    assert.equal(
      (
        await sql.begin((tx) =>
          getOrCreateRun(tx, new Date().toISOString().slice(0, 10)),
        )
      ).id,
      runId,
    );

    // A capped crawl is never allowed to remove adverts it did not reach.
    await sql`UPDATE listings SET is_active = true WHERE source_id = 'gone'`;
    const cappedId = randomUUID();
    await sql`INSERT INTO pipeline_runs (id, state) VALUES (${cappedId}, ${JSON.stringify(initialState(["sreality"], 1))}::jsonb)`;
    context.mock.method(globalThis, "fetch", async () =>
      Response.json({
        results: [
          {
            hash_id: 101,
            advert_name: "Prodej rodinného domu 120 m²",
            price_czk: 9000000,
            locality: { gps_lat: 50.1, gps_lon: 14.4 },
          },
        ],
        pagination: { total: 1000 },
      }),
    );
    for (let index = 0; index < 8; index++) {
      if ((await runBatch(cappedId, sql)).phase !== "ingest") break;
    }
    const [capped] = await sql<
      { state: PipelineState }[]
    >`SELECT state FROM pipeline_runs WHERE id = ${cappedId}`;
    assert.equal(capped.state.phase, "hash");
    assert.ok(
      capped.state.warnings.some((warning) => warning.includes("incomplete")),
    );
    assert.equal(
      (await sql`SELECT * FROM listings WHERE source_id = 'gone' AND is_active`)
        .length,
      1,
    );
  } finally {
    await sql.end();
    await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
