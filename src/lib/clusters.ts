import { sql } from "@/db";
import { anchor, env } from "@/lib/env";
import { distanceToPragueKm, nearestStation } from "@/lib/stations";
import type { ClusterCard, SortKey } from "@/lib/types";

export type ClusterFilters = {
  maxPrice?: number;
  minUsable?: number;
  maxUsable?: number;
  minLand?: number;
  areas?: string[];
  verdict?: "deal" | "fair" | "overpriced";
  goodDealsOnly?: boolean;
  freshOnly?: boolean;
  nearTrain?: boolean;
  maxPragueKm?: number;
  kind?: string;
  sort?: SortKey;
  limit?: number;
};

// Within a comfortable walk of a station — matches the card's "near train" tint.
const NEAR_TRAIN_KM = 1.5;

// biome-ignore lint/suspicious/noExplicitAny: postgres-js fragment type
type Fragment = any;

function orderBy(sort: SortKey, distance: Fragment): Fragment {
  switch (sort) {
    case "priceAsc":
      return sql`rep.price ASC NULLS LAST`;
    case "priceDesc":
      return sql`rep.price DESC NULLS LAST`;
    case "bestDeal":
      return sql`rep.percentile ASC NULLS LAST`;
    case "distance":
      return sql`${distance} ASC NULLS LAST`;
    default:
      return sql`rep.first_seen_at DESC`;
  }
}

/** One cluster row → card. postgres-js parses jsonb and returns numerics as JS numbers. */
// biome-ignore lint/suspicious/noExplicitAny: row shape is the SELECT below
function toCard(row: any): ClusterCard {
  const station =
    row.lat != null && row.lng != null
      ? nearestStation(row.lat, row.lng)
      : null;
  return {
    clusterId: row.cluster_id,
    listingId: row.listing_id,
    source: row.source,
    sourceId: row.source_id,
    url: row.url,
    price: row.price,
    minPrice: row.min_price,
    maxPrice: row.max_price,
    memberCount: row.member_count,
    propertyKind: row.property_kind,
    usableAreaM2: row.usable_area_m2,
    landAreaM2: row.land_area_m2,
    disposition: row.disposition,
    lat: row.lat,
    lng: row.lng,
    localityText: row.locality_text,
    cadastralName: row.cadastral_name,
    pricePerUsableM2: row.price_per_usable_m2,
    pricePerLandM2: row.price_per_land_m2,
    percentile: row.percentile,
    percentileConfidence: row.percentile_confidence,
    sampleSize: row.sample_size,
    dealVerdict: row.deal_verdict,
    isGoodDeal: row.is_good_deal,
    scamScore: row.scam_score,
    scamReasons: row.scam_reasons ?? [],
    dealReasons: row.deal_reasons ?? [],
    priceDropPct: row.price_drop_pct,
    photo: row.photo,
    photos: row.photos ?? [],
    description: row.description,
    firstSeenAt: row.first_seen_at,
    isNew: row.is_new,
    sellerName: row.seller_name,
    sellerType: row.seller_type,
    distanceKm: row.distance_km,
    pragueKm:
      row.lat != null && row.lng != null
        ? distanceToPragueKm(row.lat, row.lng)
        : null,
    nearestStationKm: station?.km ?? null,
    nearestStationName: station?.name ?? null,
    members: row.members ?? [],
  };
}

export async function getClusters(
  filters: ClusterFilters,
): Promise<ClusterCard[]> {
  const distance = anchor
    ? sql`ST_Distance(rep.geom::geography, ST_SetSRID(ST_MakePoint(${anchor.lng}, ${anchor.lat}), 4326)::geography) / 1000.0`
    : sql`NULL::float8`;

  const conds: Fragment[] = [sql`rep.is_active`];
  if (filters.maxPrice)
    conds.push(sql`rep.price > 0 AND rep.price <= ${filters.maxPrice}`);
  if (filters.minUsable)
    conds.push(sql`rep.usable_area_m2 >= ${filters.minUsable}`);
  if (filters.maxUsable)
    conds.push(sql`rep.usable_area_m2 <= ${filters.maxUsable}`);
  if (filters.minLand) conds.push(sql`rep.land_area_m2 >= ${filters.minLand}`);
  if (filters.areas?.length)
    conds.push(sql`rep.cadastral_code = ANY(${filters.areas})`);
  if (filters.verdict) conds.push(sql`rep.deal_verdict = ${filters.verdict}`);
  if (filters.goodDealsOnly) conds.push(sql`rep.is_good_deal`);
  if (filters.kind) conds.push(sql`rep.property_kind = ${filters.kind}`);
  if (filters.freshOnly)
    conds.push(
      sql`rep.first_seen_at > now() - make_interval(hours => ${env.FEED_WINDOW_HOURS})`,
    );

  let where = conds[0];
  for (let index = 1; index < conds.length; index += 1)
    where = sql`${where} AND ${conds[index]}`;

  const rows = await sql`
    SELECT
      c.id::int                       AS cluster_id,
      rep.id::int                     AS listing_id,
      rep.source, rep.source_id, rep.url,
      rep.price::float8               AS price,
      c.min_price::float8             AS min_price,
      c.max_price::float8             AS max_price,
      c.member_count                  AS member_count,
      rep.property_kind, rep.usable_area_m2, rep.land_area_m2, rep.disposition,
      rep.lat, rep.lng, rep.locality_text, rep.cadastral_name,
      rep.price_per_usable_m2, rep.price_per_land_m2,
      rep.percentile, rep.percentile_confidence, rep.sample_size,
      rep.deal_verdict, rep.is_good_deal, rep.scam_score,
      rep.scam_reasons, rep.deal_reasons, rep.price_drop_pct,
      rep.photos[1]                   AS photo,
      rep.photos                      AS photos,
      rep.first_seen_at               AS first_seen_at,
      (rep.first_seen_at > now() - make_interval(hours => ${env.FEED_WINDOW_HOURS})) AS is_new,
      rep.description,
      rep.seller_name, rep.seller_type,
      ${distance}                     AS distance_km,
      (
        SELECT json_agg(
          json_build_object(
            'source', m.source, 'sourceId', m.source_id,
            'url', m.url, 'price', m.price::float8
          ) ORDER BY m.price
        )
        FROM listings m WHERE m.cluster_id = c.id
      )                               AS members
    FROM clusters c
    JOIN listings rep ON rep.id = c.representative_listing_id
    WHERE ${where}
    ORDER BY ${orderBy(filters.sort ?? "newest", distance)}
    LIMIT ${filters.limit ?? 500}
  `;

  let cards = rows.map(toCard);

  // Proximity to Prague + the nearest station is computed in JS (bundled OSM
  // data), so its filter/sort live here rather than in SQL. They operate on the
  // already-filtered working set — stack a price/area/deal filter to narrow it.
  if (filters.nearTrain) {
    cards = cards.filter(
      (card) =>
        card.nearestStationKm != null && card.nearestStationKm <= NEAR_TRAIN_KM,
    );
  }
  const maxPragueKm = filters.maxPragueKm;
  if (maxPragueKm != null) {
    cards = cards.filter(
      (card) => card.pragueKm != null && card.pragueKm <= maxPragueKm,
    );
  }
  if (filters.sort === "prague") {
    cards.sort(
      (a, b) =>
        (a.pragueKm ?? Number.POSITIVE_INFINITY) -
        (b.pragueKm ?? Number.POSITIVE_INFINITY),
    );
  } else if (filters.sort === "train") {
    cards.sort(
      (a, b) =>
        (a.nearestStationKm ?? Number.POSITIVE_INFINITY) -
        (b.nearestStationKm ?? Number.POSITIVE_INFINITY),
    );
  }

  return cards;
}
