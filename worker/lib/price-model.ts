import type { PriceBasis } from "@/db/schema";
import { haversineKm } from "@/lib/stations";

export const MIN_SAMPLES = 8;
/** Above this share of the asking price, the house-alone figure is a small residual. */
export const LAND_DOMINATED_SHARE = 0.7;

export type Sample = {
  id: number;
  clusterId?: number | null;
  code: string | null;
  band: string | null;
  ppm2: number;
  kind?: string | null;
  usable?: number | null;
  land?: number | null;
  /** Local land price per m² for this plot, when the land phase found one. */
  landPpm2?: number | null;
  lat?: number | null;
  lng?: number | null;
};

export type Verdict = "deal" | "fair" | "overpriced";
export type ScoreResult = {
  /** "building": asking price minus the plot at local land prices, per usable m². */
  basis: PriceBasis;
  percentile: number;
  sampleSize: number;
  confidence: "high" | "low";
  bucketKey: string;
  verdict: Verdict;
  medianPpm2: number;
  lowerPpm2: number;
  upperPpm2: number;
  /** The subject's plot at local land prices; 0 on the asking basis. */
  landValue: number;
  /** landValue as a fraction of the asking price; 0 on the asking basis. */
  landShare: number;
  /** Middle-50% and median benchmarks as whole-house asking prices. */
  lowerPrice: number;
  medianPrice: number;
  upperPrice: number;
  comparableIds: number[];
};

/** The plot at local land prices, or null without a plot size or land price. */
export function landValueOf(sample: Sample): number | null {
  return sample.land && sample.landPpm2 ? sample.land * sample.landPpm2 : null;
}

/**
 * Price per usable m² of the house alone: the asking price minus the plot at
 * local land prices. Can be negative when the asking price is below the land's
 * estimated worth. Null without a usable area, plot size or land price.
 */
export function buildingPpm2(sample: Sample): number | null {
  const landValue = landValueOf(sample);
  if (!sample.usable || landValue === null) return null;
  return sample.ppm2 - landValue / sample.usable;
}

export function sizeBand(area: number | null | undefined): string | null {
  if (!area || area <= 0) return null;
  return area < 80
    ? "<80"
    : area < 120
      ? "80-120"
      : area < 200
        ? "120-200"
        : "200+";
}

/** Asking-price comparisons, never a sale-price appraisal. Each house votes once. */
export class PriceModel {
  private samples: Sample[];

  constructor(samples: Sample[]) {
    this.samples = samples.filter(
      (sample) => Number.isFinite(sample.ppm2) && sample.ppm2 > 0,
    );
  }

  score(subject: Sample): ScoreResult | null {
    if (!Number.isFinite(subject.ppm2) || subject.ppm2 <= 0) return null;
    // Land-adjusted when possible, so houses on different plot sizes compare
    // fairly; otherwise plain asking price per m² against every peer.
    const subjectBuilding = buildingPpm2(subject);
    const basis: PriceBasis = subjectBuilding === null ? "asking" : "building";
    const subjectValue = subjectBuilding ?? subject.ppm2;
    const metric = (sample: Sample) =>
      basis === "building" ? buildingPpm2(sample) : sample.ppm2;
    // Exclude the subject before deduplication, including its other adverts.
    const eligible = this.samples.flatMap((peer) => {
      const value = metric(peer);
      return value !== null && this.isComparable(subject, peer)
        ? [{ peer, value }]
        : [];
    });
    const groups = new Map<string, { peer: Sample; value: number }[]>();
    for (const entry of eligible) {
      const key =
        entry.peer.clusterId == null
          ? `listing:${entry.peer.id}`
          : `cluster:${entry.peer.clusterId}`;
      const group = groups.get(key) ?? [];
      group.push(entry);
      groups.set(key, group);
    }
    // Median advert is deterministic and avoids preferring an agent's highest asking price.
    const peers = [...groups.values()].map(
      (group) =>
        group.sort(
          (left, right) =>
            left.value - right.value || left.peer.id - right.peer.id,
        )[Math.floor((group.length - 1) / 2)],
    );
    const candidates: { key: string; peers: typeof peers }[] = [];
    if (subject.code)
      candidates.push({
        key: `locality:${subject.code}`,
        peers: peers.filter(({ peer }) => peer.code === subject.code),
      });
    if (subject.lat != null && subject.lng != null) {
      const lat = subject.lat;
      const lng = subject.lng;
      for (const radius of [5, 15, 30]) {
        candidates.push({
          key: `radius:${radius}km`,
          peers: peers.filter(
            ({ peer }) =>
              peer.lat != null &&
              peer.lng != null &&
              haversineKm(lat, lng, peer.lat, peer.lng) <= radius,
          ),
        });
      }
    }
    // No country-wide fallback: remote markets can make a local house look falsely cheap.
    const chosen = candidates.find(
      (candidate) => candidate.peers.length >= MIN_SAMPLES,
    );
    if (!chosen) return null;
    const sorted = chosen.peers
      .map(({ value }) => value)
      .sort((left, right) => left - right);
    const percentile = percentileRank(sorted, subjectValue);
    const lowerPpm2 = quantile(sorted, 0.25);
    const medianPpm2 = quantile(sorted, 0.5);
    const upperPpm2 = quantile(sorted, 0.75);
    const usable = subject.usable ?? 0;
    const landValue = basis === "building" ? (landValueOf(subject) ?? 0) : 0;
    const landShare = landValue / (subject.ppm2 * usable);
    const lowerPrice = landValue + lowerPpm2 * usable;
    const medianPrice = landValue + medianPpm2 * usable;
    const upperPrice = landValue + upperPpm2 * usable;
    return {
      basis,
      percentile,
      sampleSize: sorted.length,
      confidence:
        sorted.length >= 20 &&
        chosen.key !== "radius:30km" &&
        subject.kind &&
        subject.kind !== "other" &&
        subject.land &&
        chosen.peers.every(({ peer }) => Boolean(peer.land)) &&
        medianPrice > 0 &&
        (upperPrice - lowerPrice) / medianPrice <= 0.5 &&
        landShare <= LAND_DOMINATED_SHARE
          ? "high"
          : "low",
      bucketKey: chosen.key,
      verdict:
        percentile >= 80 ? "overpriced" : percentile <= 25 ? "deal" : "fair",
      lowerPpm2,
      medianPpm2,
      upperPpm2,
      landValue,
      landShare,
      lowerPrice,
      medianPrice,
      upperPrice,
      comparableIds: chosen.peers.map(({ peer }) => peer.id),
    };
  }

  /** Same type, similar floor area and, when both are known, similar plot. */
  private isComparable(subject: Sample, peer: Sample): boolean {
    if (peer.id === subject.id) return false;
    if (subject.clusterId != null && peer.clusterId === subject.clusterId)
      return false;
    if (subject.kind && subject.kind !== "other" && peer.kind !== subject.kind)
      return false;
    const isSimilarSize =
      subject.usable && peer.usable
        ? peer.usable / subject.usable >= 0.67 &&
          peer.usable / subject.usable <= 1.5
        : subject.band != null && peer.band === subject.band;
    if (!isSimilarSize) return false;
    return !(
      subject.land &&
      peer.land &&
      (peer.land / subject.land < 0.25 || peer.land / subject.land > 4)
    );
  }
}

export function percentileRank(sorted: number[], value: number): number {
  if (sorted.length === 0) return 50;
  let less = 0;
  let equal = 0;
  for (const entry of sorted) {
    if (entry < value) less += 1;
    else if (entry === value) equal += 1;
  }
  return ((less + equal / 2) / sorted.length) * 100;
}

function quantile(sorted: number[], fraction: number): number {
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  return (
    sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower)
  );
}
