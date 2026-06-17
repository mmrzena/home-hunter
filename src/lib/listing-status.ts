import type { ClusterCard } from "@/lib/types";

export type Tone = "deal" | "overpriced" | "caution" | "fair";

/** The single headline status for a listing (caution wins, then deal, then overpriced). */
export function statusBadge(
  card: ClusterCard,
): { label: string; tone: Tone } | null {
  if (card.scamScore != null && card.scamScore >= 30)
    return { label: `Caution ${card.scamScore}`, tone: "caution" };
  if (card.isGoodDeal) return { label: "Good deal", tone: "deal" };
  if (card.dealVerdict === "overpriced")
    return { label: "Overpriced", tone: "overpriced" };
  if (card.dealVerdict === "deal")
    return { label: "Below average", tone: "deal" };
  return null;
}

export const TONE_BADGE: Record<Tone, string> = {
  deal: "bg-green-600 text-white",
  overpriced: "bg-amber-500 text-white",
  caution: "bg-red-600 text-white",
  fair: "bg-muted text-foreground",
};

export const TONE_DOT: Record<Tone, string> = {
  deal: "bg-green-600",
  overpriced: "bg-amber-500",
  caution: "bg-red-600",
  fair: "bg-blueGrey-400",
};

/** Hex equivalents for non-CSS contexts (MapLibre marker DOM). */
export const TONE_HEX: Record<Tone, string> = {
  deal: "#16a34a",
  overpriced: "#f59e0b",
  caution: "#dc2626",
  fair: "#64748b",
};

/** Marker/meter color from a within-bucket percentile. */
export function percentileTone(percentile: number | null): Tone {
  if (percentile == null) return "fair";
  if (percentile <= 25) return "deal";
  if (percentile >= 80) return "overpriced";
  return "fair";
}

/** Map marker color: caution overrides the price tone. */
export function markerTone(card: ClusterCard): Tone {
  if (card.scamScore != null && card.scamScore >= 30) return "caution";
  return percentileTone(card.percentile);
}
