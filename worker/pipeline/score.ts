import { sql } from "@/db";
import type { Reason } from "@/db/schema";

import { PriceModel, type Sample } from "../lib/price-model";
import { detectRedPhrase } from "../lib/red-flags";

export type ScoreSummary = {
  scored: number;
  priced: number;
  goodDeals: number;
  flagged: number;
};

// scam-flag base weights (summed, then gated by cheapness)
const W_STOLEN = 40;
const W_RED_PHRASE = 25;
const W_PRIVATE_NO_ICO = 10;
const W_BRAND_NEW = 8;
const SUSPICIOUS_SCORE = 30;
const DEAL_PCT = 25;
const BRAND_NEW_DAYS = 3;
// flag a stolen-photo signal only when ≥ this many photos recur on a far listing
// (one shared image is usually a shared logo/map, not theft).
const STOLEN_SHARED_MIN = 3;

type Row = {
  id: string;
  price: string | null;
  usable_area_m2: number | null;
  land_area_m2: number | null;
  cadastral_code: string | null;
  size_band: string | null;
  seller_type: string | null;
  has_ico: boolean | null;
  description: string | null;
  posted_at: string | null;
};

export async function score(): Promise<ScoreSummary> {
  const rows = await sql<Row[]>`
    SELECT id, price, usable_area_m2, land_area_m2, cadastral_code, size_band,
           seller_type, has_ico, description, posted_at
    FROM listings WHERE is_active
  `;

  // Highest price ever recorded per listing → price-drop signal.
  const drops = await sql<{ listing_id: string; max_price: string }[]>`
    SELECT listing_id, max(price) AS max_price FROM price_history GROUP BY listing_id
  `;
  const maxPriceById = new Map(
    drops.map((d) => [d.listing_id, Number(d.max_price)]),
  );

  // Listings whose gallery recurs on a far-away, different-cluster listing.
  const stolenRows = await sql<{ id: string }[]>`
    WITH far_shared AS (
      SELECT ha.listing_id AS a, count(DISTINCT ha.position) AS shared
      FROM listing_image_hashes ha
      JOIN listing_image_hashes hb
        ON ha.listing_id <> hb.listing_id
       AND bit_count((ha.dhash # hb.dhash)::bit(64)) <= 10
      JOIN listings la ON la.id = ha.listing_id AND la.is_active AND la.geom IS NOT NULL
      JOIN listings lb ON lb.id = hb.listing_id AND lb.geom IS NOT NULL
      WHERE la.cluster_id IS DISTINCT FROM lb.cluster_id
        AND ST_Distance(la.geom::geography, lb.geom::geography) > 2000
      GROUP BY ha.listing_id
    )
    SELECT a AS id FROM far_shared WHERE shared >= ${STOLEN_SHARED_MIN}
  `;
  const stolen = new Set(stolenRows.map((r) => r.id));

  const ppm2ById = new Map<string, number>();
  const samples: Sample[] = [];
  for (const row of rows) {
    const price = row.price === null ? 0 : Number(row.price);
    const usable = row.usable_area_m2 ?? 0;
    if (price > 0 && usable > 0) {
      const ppm2 = Math.round(price / usable);
      ppm2ById.set(row.id, ppm2);
      samples.push({
        id: Number(row.id),
        code: row.cadastral_code,
        band: row.size_band,
        ppm2,
      });
    }
  }
  const model = new PriceModel(samples);

  const now = Date.now();
  const summary: ScoreSummary = {
    scored: 0,
    priced: 0,
    goodDeals: 0,
    flagged: 0,
  };

  for (const row of rows) {
    const price = row.price === null ? 0 : Number(row.price);
    const ppm2 = ppm2ById.get(row.id) ?? null;
    const result =
      ppm2 !== null
        ? model.score({
            id: Number(row.id),
            code: row.cadastral_code,
            band: row.size_band,
            ppm2,
          })
        : null;
    const percentile = result?.percentile ?? null;

    const land = row.land_area_m2 ?? 0;
    const pricePerLand =
      price > 0 && land > 0 ? Math.round(price / land) : null;

    // price drop
    const maxPrice = maxPriceById.get(row.id);
    const dropPct =
      maxPrice && price > 0 && maxPrice > price
        ? ((maxPrice - price) / maxPrice) * 100
        : null;

    // ── scam flags ────────────────────────────────────────────────────────
    const scamReasons: Reason[] = [];
    let base = 0;
    if (stolen.has(row.id)) {
      scamReasons.push({
        code: "stolen_photos",
        label: "Photos also appear on a distant listing",
        weight: W_STOLEN,
      });
      base += W_STOLEN;
    }
    const phrase = detectRedPhrase(row.description);
    if (phrase) {
      scamReasons.push({
        code: "red_phrase",
        label: phrase,
        weight: W_RED_PHRASE,
      });
      base += W_RED_PHRASE;
    }
    if (row.seller_type === "private" && !row.has_ico) {
      scamReasons.push({
        code: "private_no_ico",
        label: "Private seller, no IČO",
        weight: W_PRIVATE_NO_ICO,
      });
      base += W_PRIVATE_NO_ICO;
    }
    const ageDays = row.posted_at
      ? (now - new Date(row.posted_at).getTime()) / 86_400_000
      : null;
    if (ageDays !== null && ageDays <= BRAND_NEW_DAYS) {
      scamReasons.push({
        code: "brand_new",
        label: "Listed in the last few days",
        weight: W_BRAND_NEW,
      });
      base += W_BRAND_NEW;
    }

    // Cheapness is the gate: the same flags on a normally-/over-priced listing
    // are far less likely to be a scam, so dampen; amplify when suspiciously cheap.
    let factor = 0.6; // unknown price → mild
    if (percentile !== null)
      factor = percentile <= 10 ? 1.6 : percentile <= 25 ? 1.0 : 0.4;
    const scamScore = base === 0 ? 0 : Math.min(100, Math.round(base * factor));

    // ── deal flags ────────────────────────────────────────────────────────
    const dealReasons: Reason[] = [];
    if (percentile !== null && percentile <= DEAL_PCT) {
      dealReasons.push({
        code: "low_percentile",
        label: `Bottom ${Math.round(percentile)}% of CZK/m² for the area`,
        weight: 1 - percentile / 100,
      });
    }
    if (dropPct !== null && dropPct >= 3) {
      dealReasons.push({
        code: "price_drop",
        label: `Price dropped ${Math.round(dropPct)}% since first seen`,
        weight: Math.min(1, dropPct / 20),
      });
    }
    const isGoodDeal =
      percentile !== null &&
      percentile <= DEAL_PCT &&
      scamScore < SUSPICIOUS_SCORE;

    await sql`
      UPDATE listings SET
        price_per_usable_m2 = ${ppm2},
        price_per_land_m2 = ${pricePerLand},
        percentile = ${percentile},
        percentile_confidence = ${result?.confidence ?? null},
        sample_size = ${result?.sampleSize ?? null},
        bucket_key = ${result?.bucketKey ?? null},
        deal_verdict = ${result?.verdict ?? null},
        is_good_deal = ${isGoodDeal},
        scam_score = ${scamScore},
        scam_reasons = ${JSON.stringify(scamReasons)}::jsonb,
        deal_reasons = ${JSON.stringify(dealReasons)}::jsonb,
        price_drop_pct = ${dropPct},
        scored_at = now()
      WHERE id = ${row.id}
    `;

    summary.scored += 1;
    if (ppm2 !== null) summary.priced += 1;
    if (isGoodDeal) summary.goodDeals += 1;
    if (scamScore >= SUSPICIOUS_SCORE) summary.flagged += 1;
  }

  console.log("score done:", summary);
  return summary;
}
