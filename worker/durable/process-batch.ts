import pLimit from "p-limit";
import type { TransactionSql } from "postgres";
import { env } from "@/lib/env";
import { dhash } from "../lib/dhash";
import { getImageBuffer } from "../lib/http";
import { UnionFind } from "../lib/union-find";
import { nextPhase, type PipelineState } from "./state";

export async function hashBatch(sql: TransactionSql, state: PipelineState) {
  const pending = await sql<{ id: number; photos: string[] }[]>`
    SELECT id::int, photos FROM listings l WHERE is_active AND id > ${state.cursor}
      AND cardinality(photos) > 0 AND NOT EXISTS (SELECT 1 FROM listing_image_hashes h WHERE h.listing_id = l.id)
    ORDER BY id LIMIT 4
  `;
  const limit = pLimit(Math.min(env.IMAGE_CONCURRENCY, 3));
  for (const listing of pending) {
    const hashes = await Promise.all(
      listing.photos
        .slice(0, Math.min(env.MAX_IMAGES_PER_LISTING, 8))
        .map((url, position) =>
          limit(async () => {
            const buffer = await getImageBuffer(url);
            const hash = buffer ? await dhash(buffer) : null;
            return hash === null
              ? null
              : {
                  listing_id: listing.id,
                  position,
                  url,
                  dhash: hash.toString(),
                };
          }),
        ),
    );
    const rows = hashes.filter((row) => row !== null);
    if (rows.length)
      await sql`INSERT INTO listing_image_hashes ${sql(rows)} ON CONFLICT (listing_id, position) DO NOTHING`;
    state.cursor = listing.id;
    state.hashed += rows.length;
  }
  if (pending.length < 4) nextPhase(state, "bucket");
}

export async function bucketBatch(sql: TransactionSql, state: PipelineState) {
  const ids = await sql<
    { id: number }[]
  >`SELECT id::int FROM listings WHERE is_active AND id > ${state.cursor} ORDER BY id LIMIT 500`;
  if (!ids.length) {
    nextPhase(state, "edges");
    return;
  }
  await sql`
    WITH resolved AS (
      SELECT l.id, a.code, a.name FROM listings l
      LEFT JOIN LATERAL (SELECT code, name FROM areas WHERE ST_Covers(geom, l.geom) ORDER BY code LIMIT 1) a ON true
      WHERE l.id = ANY(${ids.map((row) => row.id)})
    )
    UPDATE listings l SET
      cadastral_code = coalesce(r.code, 'loc:' || l.locality_text),
      cadastral_name = coalesce(r.name, l.locality_text),
      bucket_source = CASE WHEN r.code IS NOT NULL THEN 'polygon' WHEN l.locality_text IS NOT NULL THEN 'locality' END,
      size_band = CASE WHEN usable_area_m2 IS NULL OR usable_area_m2 <= 0 THEN NULL
        WHEN usable_area_m2 < 80 THEN '<80' WHEN usable_area_m2 < 120 THEN '80-120'
        WHEN usable_area_m2 < 200 THEN '120-200' ELSE '200+' END
    FROM resolved r WHERE l.id = r.id
  `;
  state.cursor = ids[ids.length - 1].id;
}

export async function edgeBatch(
  sql: TransactionSql,
  state: PipelineState,
  runId: string,
) {
  const ids = await sql<
    { id: number }[]
  >`SELECT id::int FROM listings WHERE is_active AND id > ${state.cursor} ORDER BY id LIMIT 100`;
  if (!ids.length) {
    nextPhase(state, "clusters");
    return;
  }
  await sql`
    INSERT INTO pipeline_edges (run_id, a_id, b_id)
    SELECT ${runId}, a.id, b.id FROM listings a JOIN listings b
      ON a.id < b.id AND b.is_active AND a.deal_type = b.deal_type
      AND a.usable_area_m2 > 0 AND b.usable_area_m2 > 0
      AND abs(a.usable_area_m2 - b.usable_area_m2) <= 0.1 * greatest(a.usable_area_m2, b.usable_area_m2)
      AND ST_DWithin(a.geom::geography, b.geom::geography, 50)
    WHERE a.id = ANY(${ids.map((row) => row.id)}) AND EXISTS (
      SELECT 1 FROM listing_image_hashes ha JOIN listing_image_hashes hb ON hb.listing_id = b.id
      WHERE ha.listing_id = a.id AND bit_count((ha.dhash # hb.dhash)::bit(64)) <= 10
    ) ON CONFLICT DO NOTHING
  `;
  state.cursor = ids[ids.length - 1].id;
}

export async function publishClusters(
  sql: TransactionSql,
  state: PipelineState,
  runId: string,
) {
  const rows = await sql<
    { id: number; price: number | null }[]
  >`SELECT id::int, price::float8 FROM listings WHERE is_active ORDER BY id`;
  const edges = await sql<
    { a: number; b: number }[]
  >`SELECT a_id::int AS a, b_id::int AS b FROM pipeline_edges WHERE run_id = ${runId}`;
  const uf = new UnionFind();
  const prices = new Map(rows.map((row) => [row.id, row.price]));
  for (const row of rows) uf.add(row.id);
  for (const edge of edges)
    if (prices.has(edge.a) && prices.has(edge.b)) uf.union(edge.a, edge.b);
  const groups = [...uf.groups().values()].map((members) => {
    const priced = members
      .map((id) => ({ id, price: prices.get(id) }))
      .filter(
        (row): row is { id: number; price: number } =>
          row.price != null && row.price > 0,
      );
    priced.sort(
      (left, right) => left.price - right.price || left.id - right.id,
    );
    return {
      members,
      rep: priced[0]?.id ?? members[0],
      min: priced[0]?.price ?? null,
      max: priced.at(-1)?.price ?? null,
    };
  });
  // Publish once, atomically. Reuse IDs for unchanged representatives so saved triage survives.
  await sql`CREATE TEMP TABLE cluster_snapshot ON COMMIT DROP AS
    SELECT coalesce((SELECT min(id) FROM clusters WHERE representative_listing_id = item.rep), nextval('clusters_id_seq')) AS id,
      item.rep, item.min, item.max, item.members
    FROM jsonb_to_recordset(${JSON.stringify(groups)}::jsonb) AS item(rep bigint, min bigint, max bigint, members bigint[])`;
  await sql`INSERT INTO clusters (id, representative_listing_id, min_price, max_price, member_count)
    SELECT id, rep, min, max, cardinality(members) FROM cluster_snapshot
    ON CONFLICT (id) DO UPDATE SET representative_listing_id = EXCLUDED.representative_listing_id,
      min_price = EXCLUDED.min_price, max_price = EXCLUDED.max_price, member_count = EXCLUDED.member_count, updated_at = now()`;
  await sql`UPDATE listings l SET cluster_id = s.id FROM cluster_snapshot s WHERE l.id = ANY(s.members)`;
  await sql`UPDATE listings SET cluster_id = NULL WHERE NOT is_active`;
  await sql`DELETE FROM clusters WHERE id NOT IN (SELECT id FROM cluster_snapshot)`;
  await sql`DELETE FROM pipeline_edges WHERE run_id = ${runId}`;
  nextPhase(state, "score");
}
