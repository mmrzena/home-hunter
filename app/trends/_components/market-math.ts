import type { SegmentSummary } from "@/lib/market-trends";

const DAYS_PER_MONTH = 30.4;
const MIN_SAMPLE = 10;
export const MIN_SAME_HOUSE_SAMPLE = 20;

export function sameHouseChange(summary: SegmentSummary): number | null {
  return summary.sameHouseSample >= MIN_SAME_HOUSE_SAMPLE
    ? summary.sameHouseChange8w
    : null;
}

export function daysOnMarket(
  summary: SegmentSummary,
): { median: number | null; fast: number | null } | null {
  if (summary.goneSample < MIN_SAMPLE) return null;
  return {
    median: summary.medianDaysOnMarket,
    fast: summary.fastDaysOnMarket,
  };
}

export function cutShare(summary: SegmentSummary): number | null {
  return summary.activeListings >= MIN_SAMPLE ? summary.cutShare : null;
}

/** Months to clear today's stock at the pace adverts left over the last 4 weeks. */
export function monthsOfSupply(summary: SegmentSummary): number | null {
  if (summary.goneLast4w < MIN_SAMPLE) return null;
  return summary.activeListings / ((summary.goneLast4w * DAYS_PER_MONTH) / 28);
}
