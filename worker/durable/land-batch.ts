import { setTimeout as sleep } from "node:timers/promises";
import type { TransactionSql } from "postgres";
import { env } from "@/lib/env";
import { estimateLandPrices } from "../lib/land-price";
import { inRegionBbox } from "../lib/regions";
import {
  fetchLandPage,
  LAND_SEARCH_COUNT,
  LAND_SOURCES,
  type LandSource,
} from "../sources/land";
import { advanceCrawl } from "./crawl";
import { nextPhase, type PipelineState } from "./state";

const LAND_PRICE_BATCH = 300;

/** One results page of building plots per batch, upserted in one statement. */
export async function landIngestBatch(
  sql: TransactionSql,
  state: PipelineState,
  startedAt: string,
) {
  const sources = state.sources.filter((source): source is LandSource =>
    LAND_SOURCES.some((land) => land === source),
  );
  const source = sources.at(state.sourceIndex);
  if (!source) {
    nextPhase(state, "hash");
    return;
  }
  await sleep(Math.min(env.REQUEST_DELAY_MS, 2_000));
  const { plots, isLastPage } = await fetchLandPage(
    source,
    state.regionIndex,
    state.page,
  );
  const rows = plots
    .filter((plot) => inRegionBbox(plot.lat, plot.lng))
    .map((plot) => ({
      source: plot.source,
      source_id: plot.sourceId,
      price: plot.price ?? null,
      area_m2: plot.areaM2 ?? null,
      lat: plot.lat ?? null,
      lng: plot.lng ?? null,
      locality_text: plot.localityText ?? null,
      last_seen_at: startedAt,
      is_active: true,
    }));
  if (rows.length > 0)
    await sql`INSERT INTO land_listings ${sql(rows)}
      ON CONFLICT (source, source_id) DO UPDATE SET price = EXCLUDED.price,
        area_m2 = EXCLUDED.area_m2, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
        locality_text = EXCLUDED.locality_text, last_seen_at = EXCLUDED.last_seen_at,
        is_active = true`;
  state.sourceSeen += rows.length;
  await advanceCrawl(sql, state, {
    table: "land_listings",
    source,
    searchCount: LAND_SEARCH_COUNT[source],
    hasMorePages: !isLastPage,
    isSearchComplete: isLastPage,
    startedAt,
  });
}

/** Stores each house's local land price per m², or clears it when there's none. */
export async function landPriceBatch(
  sql: TransactionSql,
  state: PipelineState,
) {
  const listings = await sql<
    {
      id: number;
      lat: number | null;
      lng: number | null;
      plot: number | null;
    }[]
  >`SELECT id::int, lat, lng, land_area_m2 AS plot FROM listings
    WHERE is_active AND id > ${state.cursor} ORDER BY id LIMIT ${LAND_PRICE_BATCH}`;
  if (listings.length === 0) {
    nextPhase(state, "edges");
    return;
  }
  const estimates = await estimateLandPrices(
    sql,
    listings.flatMap(({ id, lat, lng, plot }) =>
      lat != null && lng != null && plot
        ? [{ id, lat, lng, plotM2: plot }]
        : [],
    ),
  );
  const ids: number[] = [];
  const ppm2: (number | null)[] = [];
  const sample: (number | null)[] = [];
  const radius: (number | null)[] = [];
  for (const { id } of listings) {
    const estimate = estimates.get(id);
    ids.push(id);
    ppm2.push(estimate?.ppm2 ?? null);
    sample.push(estimate?.sample ?? null);
    radius.push(estimate?.radiusKm ?? null);
  }
  await sql`
    UPDATE listings l SET land_price_m2 = v.ppm2, land_price_sample = v.sample,
      land_price_radius_km = v.radius
    FROM unnest(${ids}::bigint[], ${ppm2}::int[], ${sample}::int[], ${radius}::int[])
      AS v(id, ppm2, sample, radius)
    WHERE l.id = v.id AND (l.land_price_m2, l.land_price_sample, l.land_price_radius_km)
      IS DISTINCT FROM (v.ppm2, v.sample, v.radius)
  `;
  state.cursor = ids[ids.length - 1];
}
