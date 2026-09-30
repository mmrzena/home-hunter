import { sql as defaultSql } from "@/db";
import type { Database } from "./database";
import { type Sample, sizeBand } from "./price-model";

export type MarketListing = Sample & {
  price: number;
  usable: number;
  url: string | null;
  locality: string | null;
  source: string;
  sourceId: string;
  lastSeenAt: string;
};

export async function getMarketListings(
  sql: Database = defaultSql,
): Promise<MarketListing[]> {
  const rows = await sql<Omit<MarketListing, "band" | "ppm2">[]>`
    SELECT id::int, cluster_id::int AS "clusterId", cadastral_code AS code,
      property_kind AS kind, usable_area_m2 AS usable, land_area_m2 AS land,
      lat, lng, price::float8 AS price, url, locality_text AS locality,
      source, source_id AS "sourceId", last_seen_at AS "lastSeenAt"
    FROM listings
    WHERE is_active AND deal_type = 'sell' AND currency = 'CZK'
      AND price > 0 AND usable_area_m2 > 0
      AND last_seen_at >= now() - interval '90 days'
  `;
  return rows.map((row) => ({
    ...row,
    band: sizeBand(row.usable),
    ppm2: row.price / row.usable,
  }));
}
