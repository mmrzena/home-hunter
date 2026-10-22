import { unstable_cache } from "next/cache";
import { sql } from "@/db";
import { HUBS, type Hub, JICIN_RADIUS_KM } from "@/lib/hubs";

export const MARKET_SEGMENTS = [
  "all",
  "prague",
  "belt",
  "outer",
  "jicin",
] as const;
export type MarketSegment = (typeof MARKET_SEGMENTS)[number];

export const SEGMENT_LABEL: Record<MarketSegment, string> = {
  all: "All areas",
  prague: "Prague",
  belt: "Prague belt",
  outer: "Further out",
  jicin: "Jičín area",
};

const PRAGUE_CITY_KM = 12;
const PRAGUE_BELT_KM = 35;

export const SEGMENT_HINT: Record<MarketSegment, string> = {
  all: "Everything the pipeline tracks",
  prague: `Within ${PRAGUE_CITY_KM} km of the centre`,
  belt: `${PRAGUE_CITY_KM}–${PRAGUE_BELT_KM} km from Prague`,
  outer: `${PRAGUE_BELT_KM}+ km from Prague`,
  jicin: `Within ${JICIN_RADIUS_KM} km of Jičín`,
};

// A source's (or area's) first crawl finds its whole backlog at once; those
// adverts were listed before we looked, so they don't count as "new" and their
// time on the market is unknown.
const ONBOARDING_GRACE = "3 days";
const MIN_WEEKLY_SAMPLE = 8;
const MIN_AREA_M2 = 40;
const MAX_AREA_M2 = 1000;
const TIME_ZONE = "Europe/Prague";

export type WeeklyPoint = {
  week: string;
  active: number;
  medianPpm2: number | null;
  lowerPpm2: number | null;
  upperPpm2: number | null;
  newListings: number;
  gone: number;
  priceCuts: number;
  medianCutPct: number | null;
};

export type SegmentSummary = {
  segment: MarketSegment;
  activeHouses: number;
  activeListings: number;
  medianPrice: number | null;
  medianPpm2: number | null;
  cutShare: number | null;
  medianTotalCutPct: number | null;
  medianDaysToFirstCut: number | null;
  medianDaysOnMarket: number | null;
  fastDaysOnMarket: number | null;
  goneSample: number;
  staleListings: number;
  sameHouseChange8w: number | null;
  sameHouseSample: number;
  newLast4w: number;
  goneLast4w: number;
};

export type MarketTrends = {
  segment: MarketSegment;
  observedAt: string | null;
  weekly: WeeklyPoint[];
  summaries: SegmentSummary[];
};

export function parseSegment(value: string | string[] | undefined) {
  return MARKET_SEGMENTS.find((segment) => segment === value) ?? "all";
}

export function segmentHref(segment: MarketSegment): string {
  return segment === "all" ? "/trends" : `/trends?area=${segment}`;
}

type Fragment = ReturnType<typeof sql>;

function hubPoint(hub: Hub) {
  return sql`ST_SetSRID(ST_MakePoint(${hub.lng}::float8, ${hub.lat}::float8), 4326)`;
}

function weekOf(column: Fragment) {
  return sql`date_trunc('week', ${column} AT TIME ZONE ${TIME_ZONE})::date`;
}

const HAS_PLAUSIBLE_AREA = sql`area BETWEEN ${MIN_AREA_M2} AND ${MAX_AREA_M2}`;

/** Sell listings by segment — the same hub rule as `nearestHub` — and whether we saw them get listed. */
function scopedListings() {
  return sql`
    SELECT d.*,
      CASE
        WHEN d.jicin_m <= ${JICIN_RADIUS_KM * 1000} THEN 'jicin'
        WHEN d.prague_m <= ${PRAGUE_CITY_KM * 1000} THEN 'prague'
        WHEN d.prague_m <= ${PRAGUE_BELT_KM * 1000} THEN 'belt'
        ELSE 'outer'
      END AS segment
    FROM (
      SELECT l.id, l.source, l.cluster_id, l.usable_area_m2 AS area, l.price,
        l.first_seen_at, l.last_seen_at, l.is_active,
        ST_DistanceSphere(l.geom, ${hubPoint(HUBS.jicin)}) AS jicin_m,
        ST_DistanceSphere(l.geom, ${hubPoint(HUBS.prague)}) AS prague_m
      FROM listings l
      WHERE l.deal_type = 'sell' AND l.geom IS NOT NULL
    ) d`;
}

function withFreshness() {
  return sql`
    SELECT c.*, c.first_seen_at > min(c.first_seen_at) OVER (PARTITION BY c.source, c.segment)
      + ${ONBOARDING_GRACE}::interval AS is_fresh
    FROM (${scopedListings()}) c`;
}

/** Asking-price steps; a halving is a typo or another property swapped in, not a cut. */
function priceMoves(listingIds: Fragment) {
  return sql`
    SELECT listing_id, seen_at, price,
      lead(seen_at) OVER w AS to_at,
      price < lag(price) OVER w AND price >= lag(price) OVER w / 2 AS is_cut,
      100 * (1 - price::float8 / lag(price) OVER w) AS cut_pct
    FROM price_history
    WHERE price > 0 AND listing_id IN (${listingIds})
    WINDOW w AS (PARTITION BY listing_id ORDER BY seen_at)`;
}

function getWeekly(segment: MarketSegment): Promise<WeeklyPoint[]> {
  const inSegment = segment === "all" ? sql`true` : sql`segment = ${segment}`;
  return sql<WeeklyPoint[]>`
    WITH sel AS (SELECT * FROM (${withFreshness()}) f WHERE ${inSegment}),
    latest AS (SELECT max(last_seen_at) AS at FROM listings),
    moves AS (${priceMoves(sql`SELECT id FROM sel`)}),
    weeks AS (
      SELECT wk::date AS week, (wk + interval '7 days') AT TIME ZONE ${TIME_ZONE} AS at
      FROM latest, generate_series(
        date_trunc('week', (SELECT min(first_seen_at) FROM sel) AT TIME ZONE ${TIME_ZONE}),
        date_trunc('week', latest.at AT TIME ZONE ${TIME_ZONE}) - interval '1 week',
        interval '1 week') wk
    ),
    snapshot AS (
      SELECT w.week, s.area, m.price
      FROM weeks w
      JOIN sel s ON s.first_seen_at <= w.at AND (s.is_active OR s.last_seen_at >= w.at)
      LEFT JOIN moves m ON m.listing_id = s.id AND m.seen_at <= w.at
        AND (m.to_at IS NULL OR m.to_at > w.at)
    ),
    stock AS (
      SELECT week, count(*)::int AS active,
        count(*) FILTER (WHERE price > 0 AND ${HAS_PLAUSIBLE_AREA})::int AS priced,
        percentile_cont(ARRAY[0.25, 0.5, 0.75]) WITHIN GROUP (ORDER BY price::float8 / area)
          FILTER (WHERE price > 0 AND ${HAS_PLAUSIBLE_AREA}) AS ppm2
      FROM snapshot GROUP BY week
    ),
    fresh_weeks AS (
      SELECT ${weekOf(sql`first_seen_at`)} AS week, count(*)::int AS n
      FROM sel WHERE is_fresh GROUP BY 1
    ),
    gone_weeks AS (
      SELECT ${weekOf(sql`last_seen_at`)} AS week, count(*)::int AS n
      FROM sel WHERE NOT is_active GROUP BY 1
    ),
    cut_weeks AS (
      SELECT ${weekOf(sql`seen_at`)} AS week, count(*)::int AS n,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY cut_pct) AS median_pct
      FROM moves WHERE is_cut GROUP BY 1
    )
    SELECT stock.week::text AS week, stock.active,
      CASE WHEN priced >= ${MIN_WEEKLY_SAMPLE} THEN ppm2[2] END AS "medianPpm2",
      CASE WHEN priced >= ${MIN_WEEKLY_SAMPLE} THEN ppm2[1] END AS "lowerPpm2",
      CASE WHEN priced >= ${MIN_WEEKLY_SAMPLE} THEN ppm2[3] END AS "upperPpm2",
      coalesce(fresh_weeks.n, 0) AS "newListings",
      coalesce(gone_weeks.n, 0) AS gone,
      coalesce(cut_weeks.n, 0) AS "priceCuts",
      cut_weeks.median_pct AS "medianCutPct"
    FROM stock
    LEFT JOIN fresh_weeks USING (week)
    LEFT JOIN gone_weeks USING (week)
    LEFT JOIN cut_weeks USING (week)
    ORDER BY stock.week`;
}

type SummaryRow = SegmentSummary & { observedAt: string | null };

function getSummaries(): Promise<SummaryRow[]> {
  const daysListed = sql`extract(epoch FROM last_seen_at - first_seen_at) / 86400`;
  return sql<SummaryRow[]>`
    WITH sel AS (${withFreshness()}),
    latest AS (SELECT max(last_seen_at) AS at FROM listings),
    moves AS (${priceMoves(sql`SELECT id FROM sel`)}),
    per_listing AS (
      SELECT listing_id,
        (array_agg(price ORDER BY seen_at))[1] AS first_price,
        min(seen_at) FILTER (WHERE is_cut) AS cut_at,
        (array_agg(price ORDER BY seen_at DESC)
          FILTER (WHERE seen_at <= latest.at - interval '56 days'))[1] AS price_8w
      FROM moves, latest GROUP BY listing_id
    ),
    rows AS (
      SELECT s.*, latest.at, p.first_price, p.cut_at,
        coalesce(s.price < p.first_price AND s.price >= p.first_price / 2, false) AS has_cut,
        CASE WHEN s.is_active AND s.price > 0
          AND s.price::float8 / p.price_8w BETWEEN 0.5 AND 1.5
          THEN s.price::float8 / p.price_8w - 1 END AS change_8w
      FROM sel s
      CROSS JOIN latest
      LEFT JOIN per_listing p ON p.listing_id = s.id
    )
    SELECT coalesce(segment, 'all') AS segment,
      max(at)::text AS "observedAt",
      count(DISTINCT coalesce(cluster_id, -id)) FILTER (WHERE is_active)::int AS "activeHouses",
      count(*) FILTER (WHERE is_active)::int AS "activeListings",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY price::float8)
        FILTER (WHERE is_active AND price > 0) AS "medianPrice",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY price::float8 / area)
        FILTER (WHERE is_active AND price > 0 AND ${HAS_PLAUSIBLE_AREA}) AS "medianPpm2",
      avg(has_cut::int::float8) FILTER (WHERE is_active AND price > 0) AS "cutShare",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY 100 * (1 - price::float8 / first_price))
        FILTER (WHERE is_active AND has_cut) AS "medianTotalCutPct",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM cut_at - first_seen_at) / 86400)
        FILTER (WHERE is_fresh AND cut_at IS NOT NULL) AS "medianDaysToFirstCut",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ${daysListed})
        FILTER (WHERE is_fresh AND NOT is_active) AS "medianDaysOnMarket",
      percentile_cont(0.25) WITHIN GROUP (ORDER BY ${daysListed})
        FILTER (WHERE is_fresh AND NOT is_active) AS "fastDaysOnMarket",
      count(*) FILTER (WHERE is_fresh AND NOT is_active)::int AS "goneSample",
      count(*) FILTER (WHERE is_active AND first_seen_at <= at - interval '90 days')::int AS "staleListings",
      avg(change_8w) AS "sameHouseChange8w",
      count(change_8w)::int AS "sameHouseSample",
      count(*) FILTER (WHERE is_fresh AND first_seen_at > at - interval '28 days')::int AS "newLast4w",
      count(*) FILTER (WHERE NOT is_active AND last_seen_at > at - interval '28 days')::int AS "goneLast4w"
    FROM rows
    GROUP BY GROUPING SETS ((segment), ())`;
}

async function loadMarketTrends(segment: MarketSegment): Promise<MarketTrends> {
  const [weekly, rows] = await Promise.all([
    getWeekly(segment),
    getSummaries(),
  ]);
  const order = (row: SegmentSummary) => MARKET_SEGMENTS.indexOf(row.segment);
  return {
    segment,
    observedAt: rows[0]?.observedAt ?? null,
    weekly,
    summaries: rows.sort((a, b) => order(a) - order(b)),
  };
}

export const getMarketTrends = unstable_cache(
  loadMarketTrends,
  ["market-trends"],
  { revalidate: 3600 },
);
