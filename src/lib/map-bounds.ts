import type { ClusterCard } from "@/lib/types";

/** A map viewport as [west, south, east, north] (WGS84 degrees). */
export type MapBounds = [number, number, number, number];

export function isInBounds(card: ClusterCard, bounds: MapBounds): boolean {
  const [west, south, east, north] = bounds;
  return (
    card.lat != null &&
    card.lng != null &&
    card.lng >= west &&
    card.lng <= east &&
    card.lat >= south &&
    card.lat <= north
  );
}
