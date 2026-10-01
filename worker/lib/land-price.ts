import type { Database } from "./database";

/**
 * Local building-land price for a house's plot: the median price per m² of
 * building plots for sale nearby, taking the smallest ring with enough of them.
 * Plots are size-matched (0.5–2× the house's plot) because price per m² falls
 * steeply with plot size. Implausible asking prices per m² (mislabelled
 * farmland, rent-like amounts, tiny development parcels) are left out, and a
 * plot listed on several portals counts once.
 */
const RADII_KM = [3, 7, 15, 30];
const MAX_RADIUS_KM = RADII_KM[RADII_KM.length - 1];
const MIN_LAND_SAMPLES = 6;
const MIN_PLOT_M2 = 300;
const MAX_PLOT_M2 = 10_000;
const MIN_PLOT_PPM2 = 300;
const MAX_PLOT_PPM2 = 60_000;

export type LandPrice = { ppm2: number; sample: number; radiusKm: number };
export type LandPoint = {
  id: number;
  lat: number;
  lng: number;
  plotM2: number;
};

export async function estimateLandPrices(
  sql: Database,
  points: LandPoint[],
): Promise<Map<number, LandPrice>> {
  if (points.length === 0) return new Map();
  // One 30 km index scan per house; the rings are filters over that same set.
  const rows = await sql<({ id: number } & LandPrice)[]>`
    SELECT point.id::int, estimate.ppm2, estimate.sample::int, estimate.radius AS "radiusKm"
    FROM unnest(
      ${points.map((point) => point.id)}::bigint[],
      ${points.map((point) => point.lat)}::float8[],
      ${points.map((point) => point.lng)}::float8[],
      ${points.map((point) => point.plotM2)}::float8[]
    ) AS point(id, lat, lng, plot)
    CROSS JOIN LATERAL (
      SELECT ring.radius,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY plot.ppm2) AS ppm2,
        count(*) AS sample
      FROM (
        SELECT DISTINCT ON (round(land.lat::numeric, 4), round(land.lng::numeric, 4), land.area_m2)
          land.price::float8 / land.area_m2 AS ppm2,
          ST_Distance(land.geom::geography,
            ST_SetSRID(ST_MakePoint(point.lng, point.lat), 4326)::geography) / 1000 AS km
        FROM land_listings land
        WHERE land.is_active AND land.price > 0
          AND land.price::float8 / land.area_m2 BETWEEN ${MIN_PLOT_PPM2} AND ${MAX_PLOT_PPM2}
          AND land.last_seen_at >= now() - interval '90 days'
          AND land.area_m2 BETWEEN greatest(${MIN_PLOT_M2}, point.plot * 0.5)
            AND least(${MAX_PLOT_M2}, greatest(${MIN_PLOT_M2} * 2, point.plot * 2))
          AND ST_DWithin(land.geom::geography,
            ST_SetSRID(ST_MakePoint(point.lng, point.lat), 4326)::geography,
            ${MAX_RADIUS_KM * 1000})
      ) plot
      JOIN unnest(${RADII_KM}::int[]) AS ring(radius) ON plot.km <= ring.radius
      GROUP BY ring.radius HAVING count(*) >= ${MIN_LAND_SAMPLES}
      ORDER BY ring.radius LIMIT 1
    ) estimate
  `;
  return new Map(
    rows.map(({ id, ...price }) => [
      id,
      { ...price, ppm2: Math.round(price.ppm2) },
    ]),
  );
}
