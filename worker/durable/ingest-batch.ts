import { setTimeout as sleep } from "node:timers/promises";
import type { TransactionSql } from "postgres";
import { env } from "@/lib/env";
import { HttpError } from "../lib/http";
import { inRegionBbox } from "../lib/regions";
import { createBezrealitkySource } from "../sources/bezrealitky";
import { createCeskeRealitySource } from "../sources/ceskereality";
import { createSrealitySource } from "../sources/sreality";
import { askingPrice, type RawListing } from "../sources/types";
import { advanceCrawl } from "./crawl";
import { type PipelineState, startLandIngest } from "./state";

function sourceFor(state: PipelineState) {
  const options = {
    singlePage: true,
    page: state.page,
    regionIndex: state.regionIndex,
  };
  switch (state.sources[state.sourceIndex]) {
    case "sreality":
      return createSrealitySource(options);
    case "bezrealitky":
      return createBezrealitkySource(options);
    case "ceskereality":
      return createCeskeRealitySource(options);
  }
}

function values(raw: RawListing, startedAt: string) {
  const fields = {
    source: raw.source,
    source_id: raw.sourceId,
    property_kind: raw.propertyKind,
    // A placeholder price overwrites a stored one with "unknown".
    price: raw.price == null ? undefined : (askingPrice(raw.price) ?? null),
    usable_area_m2:
      raw.usableAreaM2 == null ? undefined : Math.round(raw.usableAreaM2),
    built_up_area_m2:
      raw.builtUpAreaM2 == null ? undefined : Math.round(raw.builtUpAreaM2),
    land_area_m2:
      raw.landAreaM2 == null ? undefined : Math.round(raw.landAreaM2),
    disposition: raw.disposition,
    lat: raw.lat,
    lng: raw.lng,
    locality_text: raw.localityText,
    seller_type: raw.sellerType,
    seller_name: raw.sellerName,
    has_ico: raw.hasIco,
    description: raw.description,
    url: raw.url,
    photos: raw.photos,
    labels: raw.labels,
    posted_at: raw.postedAt && new Date(raw.postedAt).toISOString(),
    last_seen_at: startedAt,
    is_active: true,
  };
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

export async function ingestBatch(
  sql: TransactionSql,
  state: PipelineState,
  startedAt: string,
) {
  const source = sourceFor(state);
  if (!source) {
    startLandIngest(state);
    return;
  }
  if (state.pageItems === null) {
    // A whole fetched page is checkpointed before any of its listings are processed.
    const items: RawListing[] = [];
    for await (const listing of source.listPages()) items.push(listing);
    state.pageItems = items;
    state.itemIndex = 0;
    state.pageComplete = source.completed();
    return;
  }
  const deadline = Date.now() + 100_000;
  let enriched = 0;
  const batch = state.pageItems.slice(state.itemIndex, state.itemIndex + 100);
  for (const raw of batch) {
    if (enriched >= 8 || Date.now() >= deadline) break;
    if (
      raw.propertyKind === "recreational" ||
      !inRegionBbox(raw.lat, raw.lng)
    ) {
      state.itemIndex++;
      continue;
    }
    const [existing] = await sql<
      { id: number; price: number | null; usable: number | null }[]
    >`
      SELECT id::int, price::float8, usable_area_m2 AS usable FROM listings
      WHERE source = ${raw.source} AND source_id = ${raw.sourceId} FOR UPDATE
    `;
    const shouldEnrich =
      source.name !== "bezrealitky" &&
      (!existing ||
        existing.price !== (askingPrice(raw.price) ?? null) ||
        existing.usable === null);
    let listing = raw;
    if (shouldEnrich) {
      enriched++;
      await sleep(Math.min(env.REQUEST_DELAY_MS, 2_000));
      let detail: Partial<RawListing>;
      try {
        detail = await source.enrich(raw.sourceId, raw.url);
      } catch (error) {
        // Removed between the search and its detail page. Retrying can't help;
        // left unseen, the completed crawl deactivates it.
        if (error instanceof HttpError && [404, 410].includes(error.status)) {
          state.itemIndex++;
          continue;
        }
        throw error;
      }
      if (!Object.values(detail).some((value) => value !== undefined))
        throw new Error(`No detail returned for ${raw.source}/${raw.sourceId}`);
      listing = {
        ...raw,
        ...Object.fromEntries(
          Object.entries(detail).filter(([, value]) => value !== undefined),
        ),
      };
    } else if (existing && source.name !== "bezrealitky") {
      // Search thumbnails and empty list-level labels must not erase the gallery/detail labels.
      listing = { ...raw, photos: undefined, labels: undefined };
    }
    const fields = values(listing, startedAt);
    let listingId = existing?.id;
    if (existing) {
      await sql`UPDATE listings SET ${sql(fields)} WHERE id = ${existing.id}`;
    } else {
      const [created] = await sql<
        { id: number }[]
      >`INSERT INTO listings ${sql(fields)} RETURNING id::int`;
      listingId = created.id;
    }
    const price = askingPrice(listing.price) ?? null;
    if (listingId != null && price != null && existing?.price !== price) {
      await sql`INSERT INTO price_history (listing_id, price) VALUES (${listingId}, ${price})`;
    }
    state.itemIndex++;
    state.sourceSeen++;
    state.seen++;
  }
  if (state.itemIndex < state.pageItems.length) return;
  const isEmpty = state.pageItems.length === 0;
  state.pageItems = null;
  await advanceCrawl(sql, state, {
    table: "listings",
    source: source.name,
    searchCount: source.searchCount,
    hasMorePages: !state.pageComplete && !isEmpty,
    isSearchComplete: state.pageComplete,
    startedAt,
  });
  if (state.sourceIndex >= state.sources.length) startLandIngest(state);
}
