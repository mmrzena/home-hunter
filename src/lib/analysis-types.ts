import type { Reason } from "@/db/schema";
import type { ClusterMember } from "@/lib/types";
import type { MarketListing } from "../../worker/lib/market-data";
import type { ScoreResult } from "../../worker/lib/price-model";
import type { RawListing } from "../../worker/sources/types";

export type HouseAnalysis = {
  listing: Omit<RawListing, "postedAt"> & { postedAt?: string };
  fetchedAt: string;
  valuation: ScoreResult | null;
  comparables: MarketListing[];
  warnings: string[];
  location: {
    pragueKm: number | null;
    station: { name: string; km: number } | null;
    population: number | null;
    settlementClass: string | null;
    anchorKm: number | null;
    anchorLabel: string | null;
  };
  history: { price: number; seenAt: string }[];
  members: ClusterMember[];
  firstSeenAt: string | null;
  scoredAt: string | null;
  storedScamScore: number | null;
  storedReasons: Reason[];
  descriptionFlag: string | null;
  priceDropPct: number | null;
};
