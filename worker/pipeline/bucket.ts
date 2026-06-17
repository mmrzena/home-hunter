import { sql } from "@/db";

export type BucketSummary = {
  polygon: number;
  locality: number;
  banded: number;
};

/**
 * Resolves each active listing's GPS to a canonical area:
 *  1. point-in-polygon against the seeded boundaries (preferred — consistent
 *     across sources),
 *  2. else the source's own locality string (prefixed `loc:` so it never
 *     collides with a real area code).
 * Also assigns the usable-area size band that, with the area, forms the price
 * bucket. Re-runnable: recomputes for every active listing.
 */
export async function bucket(): Promise<BucketSummary> {
  // Reset prior assignments so re-runs reflect new boundaries / areas.
  await sql`
    UPDATE listings
    SET cadastral_code = NULL, cadastral_name = NULL, bucket_source = NULL
    WHERE is_active
  `;

  const polygon = await sql`
    UPDATE listings l
    SET cadastral_code = a.code,
        cadastral_name = a.name,
        bucket_source = 'polygon'
    FROM areas a
    WHERE l.is_active
      AND l.geom IS NOT NULL
      AND ST_Contains(a.geom, l.geom)
  `;

  const locality = await sql`
    UPDATE listings
    SET cadastral_code = 'loc:' || locality_text,
        cadastral_name = locality_text,
        bucket_source = 'locality'
    WHERE is_active
      AND cadastral_code IS NULL
      AND locality_text IS NOT NULL
  `;

  const banded = await sql`
    UPDATE listings
    SET size_band = CASE
      WHEN usable_area_m2 < 80  THEN '<80'
      WHEN usable_area_m2 < 120 THEN '80-120'
      WHEN usable_area_m2 < 200 THEN '120-200'
      ELSE '200+'
    END
    WHERE is_active AND usable_area_m2 IS NOT NULL
  `;

  const summary: BucketSummary = {
    polygon: polygon.count,
    locality: locality.count,
    banded: banded.count,
  };
  console.log("bucket done:", summary);
  return summary;
}
