import { and, eq, lt } from "drizzle-orm";

import { db } from "@/db";
import { listings, priceHistory } from "@/db/schema";
import { env } from "@/lib/env";

import { inRegionBbox } from "../lib/regions";
import { createBezrealitkySource } from "../sources/bezrealitky";
import { createSrealitySource } from "../sources/sreality";
import type { RawListing, Source } from "../sources/types";

export type IngestSummary = {
  seen: number;
  inserted: number;
  updated: number;
  enriched: number;
  deactivated: number;
};

function insertValues(raw: RawListing) {
  return {
    source: raw.source,
    sourceId: raw.sourceId,
    propertyKind: raw.propertyKind,
    price: raw.price,
    usableAreaM2: raw.usableAreaM2,
    builtUpAreaM2: raw.builtUpAreaM2,
    landAreaM2: raw.landAreaM2,
    disposition: raw.disposition,
    lat: raw.lat,
    lng: raw.lng,
    localityText: raw.localityText,
    url: raw.url,
    photos: raw.photos ?? [],
    labels: raw.labels ?? [],
  };
}

/** Drop undefined keys so an enrich partial only overwrites fields it resolved. */
function definedOnly<T extends Record<string, unknown>>(object: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

async function ingestSource(
  source: Source,
  runStartedAt: Date,
  summary: IngestSummary,
) {
  const toEnrich: string[] = [];

  for await (const raw of source.listPages()) {
    if (raw.propertyKind === "recreational") continue;
    if (!inRegionBbox(raw.lat, raw.lng)) continue;
    summary.seen += 1;

    const existing = await db.query.listings.findFirst({
      columns: { id: true, price: true, usableAreaM2: true },
      where: and(
        eq(listings.source, raw.source),
        eq(listings.sourceId, raw.sourceId),
      ),
    });

    if (!existing) {
      const [row] = await db
        .insert(listings)
        .values(insertValues(raw))
        .returning({ id: listings.id });
      if (raw.price != null) {
        await db
          .insert(priceHistory)
          .values({ listingId: row.id, price: raw.price });
      }
      toEnrich.push(raw.sourceId);
      summary.inserted += 1;
      continue;
    }

    const priceChanged = raw.price != null && raw.price !== existing.price;
    await db
      .update(listings)
      .set({
        ...definedOnly({
          price: raw.price,
          lat: raw.lat,
          lng: raw.lng,
          localityText: raw.localityText,
          propertyKind: raw.propertyKind,
          url: raw.url,
        }),
        photos: raw.photos ?? [],
        // labels are set on insert + refreshed by enrich, not by the list pass
        // (Sreality's list level carries none — refreshing here would wipe them).
        lastSeenAt: runStartedAt,
        isActive: true,
      })
      .where(eq(listings.id, existing.id));

    if (priceChanged && raw.price != null) {
      await db
        .insert(priceHistory)
        .values({ listingId: existing.id, price: raw.price });
    }
    if (priceChanged || existing.usableAreaM2 == null)
      toEnrich.push(raw.sourceId);
    summary.updated += 1;
  }

  for (const sourceId of toEnrich) {
    try {
      const patch = definedOnly(await source.enrich(sourceId));
      if (Object.keys(patch).length > 0) {
        await db
          .update(listings)
          .set(patch)
          .where(
            and(
              eq(listings.source, source.name),
              eq(listings.sourceId, sourceId),
            ),
          );
        summary.enriched += 1;
      }
    } catch (error) {
      console.warn(`enrich ${source.name}/${sourceId} failed:`, error);
    }
  }

  // Only deactivate listings we didn't see this run if we actually paged to the
  // end — a capped run hasn't proven a listing is gone.
  if (source.completed()) {
    const gone = await db
      .update(listings)
      .set({ isActive: false })
      .where(
        and(
          eq(listings.source, source.name),
          eq(listings.isActive, true),
          lt(listings.lastSeenAt, runStartedAt),
        ),
      )
      .returning({ id: listings.id });
    summary.deactivated += gone.length;
  }
}

export async function ingest(): Promise<IngestSummary> {
  const runStartedAt = new Date();
  const summary: IngestSummary = {
    seen: 0,
    inserted: 0,
    updated: 0,
    enriched: 0,
    deactivated: 0,
  };

  const sources: Source[] = [createSrealitySource()];
  if (env.ENABLE_BEZREALITKY) sources.push(createBezrealitkySource());

  for (const source of sources) {
    console.log(`ingest: ${source.name}…`);
    await ingestSource(source, runStartedAt, summary);
  }

  console.log("ingest done:", summary);
  return summary;
}
