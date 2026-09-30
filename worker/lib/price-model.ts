import { haversineKm } from "@/lib/stations";

export const MIN_SAMPLES = 8;

export type Sample = {
  id: number;
  clusterId?: number | null;
  code: string | null;
  band: string | null;
  ppm2: number;
  kind?: string | null;
  usable?: number | null;
  land?: number | null;
  lat?: number | null;
  lng?: number | null;
};

export type Verdict = "deal" | "fair" | "overpriced";
export type ScoreResult = {
  percentile: number;
  sampleSize: number;
  confidence: "high" | "low";
  bucketKey: string;
  verdict: Verdict;
  medianPpm2: number;
  lowerPpm2: number;
  upperPpm2: number;
  comparableIds: number[];
};

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
    // Exclude the subject before deduplication, including its other adverts.
    const eligible = this.samples.filter(
      (peer) =>
        peer.id !== subject.id &&
        !(subject.clusterId != null && peer.clusterId === subject.clusterId) &&
        (!subject.kind ||
          subject.kind === "other" ||
          peer.kind === subject.kind) &&
        (subject.usable && peer.usable
          ? peer.usable / subject.usable >= 0.67 &&
            peer.usable / subject.usable <= 1.5
          : subject.band != null && peer.band === subject.band) &&
        !(
          subject.land &&
          peer.land &&
          (peer.land / subject.land < 0.25 || peer.land / subject.land > 4)
        ),
    );
    const groups = new Map<string, Sample[]>();
    for (const peer of eligible) {
      const key =
        peer.clusterId == null
          ? `listing:${peer.id}`
          : `cluster:${peer.clusterId}`;
      const group = groups.get(key) ?? [];
      group.push(peer);
      groups.set(key, group);
    }
    // Median advert is deterministic and avoids preferring an agent's highest asking price.
    const peers = [...groups.values()].map(
      (group) =>
        group.sort(
          (left, right) => left.ppm2 - right.ppm2 || left.id - right.id,
        )[Math.floor((group.length - 1) / 2)],
    );
    const candidates: { key: string; peers: Sample[] }[] = [];
    if (subject.code)
      candidates.push({
        key: `locality:${subject.code}`,
        peers: peers.filter((peer) => peer.code === subject.code),
      });
    if (subject.lat != null && subject.lng != null) {
      const lat = subject.lat;
      const lng = subject.lng;
      for (const radius of [5, 15, 30]) {
        candidates.push({
          key: `radius:${radius}km`,
          peers: peers.filter(
            (peer) =>
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
      .map((peer) => peer.ppm2)
      .sort((left, right) => left - right);
    const percentile = percentileRank(sorted, subject.ppm2);
    const lowerPpm2 = quantile(sorted, 0.25);
    const medianPpm2 = quantile(sorted, 0.5);
    const upperPpm2 = quantile(sorted, 0.75);
    return {
      percentile,
      sampleSize: sorted.length,
      confidence:
        sorted.length >= 20 &&
        chosen.key !== "radius:30km" &&
        subject.kind &&
        subject.kind !== "other" &&
        subject.land &&
        chosen.peers.every((peer) => Boolean(peer.land)) &&
        (upperPpm2 - lowerPpm2) / medianPpm2 <= 0.5
          ? "high"
          : "low",
      bucketKey: chosen.key,
      verdict:
        percentile >= 80 ? "overpriced" : percentile <= 25 ? "deal" : "fair",
      lowerPpm2,
      medianPpm2,
      upperPpm2,
      comparableIds: chosen.peers.map((peer) => peer.id),
    };
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
