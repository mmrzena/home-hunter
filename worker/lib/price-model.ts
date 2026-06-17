/**
 * Robust price-distribution model over CZK per usable m². Real-estate prices are
 * fat-tailed, so buckets use rank/percentile rather than mean/stddev. Most
 * (area × size-band) buckets are thin, so a listing falls back to the most
 * specific bucket that still has enough samples — and is marked low-confidence
 * when it had to widen.
 */
export const MIN_SAMPLES = 8;

export type Sample = {
  id: number;
  code: string | null; // cadastral/locality bucket
  band: string | null; // usable-area size band
  ppm2: number; // CZK per usable m²
};

export type Verdict = "deal" | "fair" | "overpriced";

export type ScoreResult = {
  percentile: number; // 0..100 within the chosen bucket
  sampleSize: number;
  confidence: "high" | "low";
  bucketKey: string;
  verdict: Verdict;
};

const OVERPRICED_PCT = 80;
const DEAL_PCT = 25;

export class PriceModel {
  private byCodeBand = new Map<string, number[]>();
  private byCode = new Map<string, number[]>();
  private byBand = new Map<string, number[]>();
  private global: number[] = [];

  constructor(samples: Sample[]) {
    for (const sample of samples) {
      this.global.push(sample.ppm2);
      if (sample.code && sample.band)
        push(this.byCodeBand, `${sample.code}|${sample.band}`, sample.ppm2);
      if (sample.code) push(this.byCode, sample.code, sample.ppm2);
      if (sample.band) push(this.byBand, sample.band, sample.ppm2);
    }
    for (const values of this.byCodeBand.values()) values.sort(ascending);
    for (const values of this.byCode.values()) values.sort(ascending);
    for (const values of this.byBand.values()) values.sort(ascending);
    this.global.sort(ascending);
  }

  /** Most specific bucket with ≥ MIN_SAMPLES; else widen, else global. */
  score(sample: Sample): ScoreResult | null {
    const candidates: Array<{
      key: string;
      values: number[];
      confidence: "high" | "low";
    }> = [];
    if (sample.code && sample.band) {
      const key = `${sample.code}|${sample.band}`;
      candidates.push({
        key,
        values: this.byCodeBand.get(key) ?? [],
        confidence: "high",
      });
    }
    if (sample.code)
      candidates.push({
        key: sample.code,
        values: this.byCode.get(sample.code) ?? [],
        confidence: "low",
      });
    if (sample.band)
      candidates.push({
        key: `band:${sample.band}`,
        values: this.byBand.get(sample.band) ?? [],
        confidence: "low",
      });
    candidates.push({ key: "all", values: this.global, confidence: "low" });

    const chosen =
      candidates.find((candidate) => candidate.values.length >= MIN_SAMPLES) ??
      candidates[candidates.length - 1];
    if (chosen.values.length < 2) return null;

    const percentile = percentileRank(chosen.values, sample.ppm2);
    const verdict: Verdict =
      percentile >= OVERPRICED_PCT
        ? "overpriced"
        : percentile <= DEAL_PCT
          ? "deal"
          : "fair";

    return {
      percentile,
      sampleSize: chosen.values.length,
      confidence: chosen.confidence,
      bucketKey: chosen.key,
      verdict,
    };
  }
}

function push(map: Map<string, number[]>, key: string, value: number) {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

function ascending(a: number, b: number) {
  return a - b;
}

/** Mid-rank percentile (0..100): ties split evenly so identical prices tie. */
export function percentileRank(sorted: number[], value: number): number {
  let less = 0;
  let equal = 0;
  for (const entry of sorted) {
    if (entry < value) less += 1;
    else if (entry === value) equal += 1;
  }
  return ((less + equal / 2) / sorted.length) * 100;
}
