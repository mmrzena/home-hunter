import { formatDistance } from "@/lib/format";
import { haversineKm } from "@/lib/geo";
import type { SettlementClass } from "@/lib/places";
import type { ClusterCard, SuggestionMatch } from "@/lib/types";

/**
 * "For you" ranks houses by resemblance to the ones you liked or contacted.
 * Deliberately not a model: a weighted profile of your examples, scored one
 * feature at a time so every suggestion can say why. Location carries the most
 * weight because house hunting is mostly "that village, not this one"; a
 * rejected house pushes its neighbourhood down the same way a liked one pulls.
 */

export type HouseFacts = Pick<
  ClusterCard,
  | "lat"
  | "lng"
  | "price"
  | "usableAreaM2"
  | "landAreaM2"
  | "propertyKind"
  | "settlementClass"
  | "nearestStationKm"
  | "percentile"
> & { placeName: string | null };

export type Example = HouseFacts & {
  weight: number;
  origin: "liked" | "contacted";
};

export const MIN_EXAMPLES = 3;
export const SUGGESTION_LIMITS = [10, 25, 50] as const;
export const SUGGESTION_RADII_KM = [5, 15, 30] as const;
export type SuggestionLimit = (typeof SUGGESTION_LIMITS)[number];
export type SuggestionRadiusKm = (typeof SUGGESTION_RADII_KM)[number];

const PULL_RADIUS_KM = 6;
const PUSH_RADIUS_KM = 3;
const PUSH_STRENGTH = 0.5;
const BAND_PADDING = 0.15;
const BAND_FADE = 0.5;
const UNKNOWN_PRICE_SCORE = 0.5;
const NEAR_REASON_KM = 12;
const CLUSTER_REASON_KM = 9;

const WEIGHTS = {
  location: 3,
  price: 2,
  usable: 1.5,
  land: 1,
  settlement: 1,
  kind: 0.5,
  station: 0.5,
  deal: 0.5,
} as const;

type Band = { min: number; max: number };

export type Profile = {
  positives: Example[];
  negatives: Example[];
  price: Band | null;
  usable: Band | null;
  land: Band | null;
  settlementShare: Map<SettlementClass, number>;
  kindShare: Map<string, number>;
  medianStationKm: number | null;
};

function band(values: number[]): Band | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min: min * (1 - BAND_PADDING), max: max * (1 + BAND_PADDING) };
}

function bandScore(value: number | null, range: Band | null): number | null {
  if (value == null || range == null) return null;
  if (value >= range.min && value <= range.max) return 1;
  const overshoot =
    value < range.min
      ? (range.min - value) / range.min
      : (value - range.max) / range.max;
  return Math.max(0, 1 - overshoot / BAND_FADE);
}

function weightedShare<Key>(
  examples: Example[],
  key: (example: Example) => Key | null,
): Map<Key, number> {
  const share = new Map<Key, number>();
  let total = 0;
  for (const example of examples) {
    const value = key(example);
    if (value == null) continue;
    share.set(value, (share.get(value) ?? 0) + example.weight);
    total += example.weight;
  }
  for (const [value, weight] of share) share.set(value, weight / total);
  return share;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function buildProfile(examples: Example[]): Profile {
  const positives = examples.filter((example) => example.weight > 0);
  const negatives = examples.filter((example) => example.weight < 0);
  const numbers = (pick: (example: Example) => number | null) =>
    positives.map(pick).filter((value): value is number => value != null);
  return {
    positives,
    negatives,
    price: band(numbers((example) => example.price)),
    usable: band(numbers((example) => example.usableAreaM2)),
    land: band(numbers((example) => example.landAreaM2)),
    settlementShare: weightedShare(positives, (ex) => ex.settlementClass),
    kindShare: weightedShare(positives, (ex) => ex.propertyKind),
    medianStationKm: median(numbers((example) => example.nearestStationKm)),
  };
}

type Proximity = { nearest: Example; nearestKm: number; closeCount: number };

function proximity(
  lat: number,
  lng: number,
  examples: Example[],
): Proximity | null {
  let nearest: Example | null = null;
  let nearestKm = Number.POSITIVE_INFINITY;
  let closeCount = 0;
  for (const example of examples) {
    if (example.lat == null || example.lng == null) continue;
    const km = haversineKm(lat, lng, example.lat, example.lng);
    if (km <= CLUSTER_REASON_KM) closeCount += 1;
    if (km < nearestKm) {
      nearest = example;
      nearestKm = km;
    }
  }
  return nearest && { nearest, nearestKm, closeCount };
}

function gaussian(km: number, radiusKm: number): number {
  return Math.exp(-((km / radiusKm) ** 2));
}

type Feature = { weight: number; score: number; reason?: string };

function locationFeature(
  positives: Proximity,
  facts: HouseFacts,
  profile: Profile,
): Feature {
  const { nearest, nearestKm, closeCount } = positives;
  const push =
    facts.lat != null && facts.lng != null
      ? proximity(facts.lat, facts.lng, profile.negatives)
      : null;
  const score = Math.max(
    0,
    Math.min(
      1,
      gaussian(nearestKm, PULL_RADIUS_KM) -
        (push ? PUSH_STRENGTH * gaussian(push.nearestKm, PUSH_RADIUS_KM) : 0),
    ),
  );
  let reason: string | undefined;
  if (closeCount >= 2) reason = `near ${closeCount} houses you picked`;
  else if (nearestKm <= NEAR_REASON_KM) {
    const verb = nearest.origin === "liked" ? "liked" : "contacted";
    const place = nearest.placeName ? ` in ${nearest.placeName}` : "";
    reason = `${formatDistance(nearestKm)} from a house you ${verb}${place}`;
  }
  return { weight: WEIGHTS.location, score, reason };
}

function bandFeature(
  value: number | null,
  range: Band | null,
  weight: number,
  reason: string,
): Feature | null {
  const score = bandScore(value, range);
  if (score == null) return null;
  return { weight, score, reason: score === 1 ? reason : undefined };
}

function priceFeature(facts: HouseFacts, profile: Profile): Feature | null {
  if (profile.price == null) return null;
  if (facts.price == null)
    return { weight: WEIGHTS.price, score: UNKNOWN_PRICE_SCORE };
  return bandFeature(
    facts.price,
    profile.price,
    WEIGHTS.price,
    "in your price range",
  );
}

function shareFeature<Key>(
  value: Key | null,
  share: Map<Key, number>,
  weight: number,
  reason?: (value: Key) => string,
): Feature | null {
  if (value == null || share.size === 0) return null;
  const score = share.get(value) ?? 0;
  return {
    weight,
    score,
    reason: reason && score >= 0.5 ? reason(value) : undefined,
  };
}

function stationFeature(facts: HouseFacts, profile: Profile): Feature | null {
  if (facts.nearestStationKm == null || profile.medianStationKm == null)
    return null;
  const gap = Math.abs(facts.nearestStationKm - profile.medianStationKm);
  return { weight: WEIGHTS.station, score: Math.max(0, 1 - gap / 3) };
}

function dealFeature(facts: HouseFacts): Feature | null {
  if (facts.percentile == null) return null;
  return { weight: WEIGHTS.deal, score: (100 - facts.percentile) / 100 };
}

function hasReason(feature: Feature): feature is Feature & { reason: string } {
  return feature.reason != null;
}

export function scoreHouse(
  facts: HouseFacts,
  profile: Profile,
  radiusKm: number | null = null,
): SuggestionMatch | null {
  const positives =
    facts.lat != null && facts.lng != null
      ? proximity(facts.lat, facts.lng, profile.positives)
      : null;
  if (radiusKm != null && positives != null && positives.nearestKm > radiusKm)
    return null;
  const features = [
    positives && locationFeature(positives, facts, profile),
    priceFeature(facts, profile),
    bandFeature(
      facts.usableAreaM2,
      profile.usable,
      WEIGHTS.usable,
      "the size you go for",
    ),
    bandFeature(
      facts.landAreaM2,
      profile.land,
      WEIGHTS.land,
      "a plot like the ones you picked",
    ),
    shareFeature(
      facts.settlementClass,
      profile.settlementShare,
      WEIGHTS.settlement,
      (value) => `a ${value.toLowerCase()}, like most you picked`,
    ),
    shareFeature(facts.propertyKind, profile.kindShare, WEIGHTS.kind),
    stationFeature(facts, profile),
    dealFeature(facts),
  ].filter((feature) => feature != null);
  const total = features.reduce((sum, feature) => sum + feature.weight, 0);
  if (total === 0) return { score: 0, reasons: [] };
  const score =
    features.reduce((sum, feature) => sum + feature.weight * feature.score, 0) /
    total;
  const reasons = features
    .filter(hasReason)
    .sort((a, b) => b.weight * b.score - a.weight * a.score)
    .slice(0, 3)
    .map((feature) => feature.reason);
  return { score, reasons };
}
