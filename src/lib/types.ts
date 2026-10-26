import type { PriceBasis, Reason, SourceName } from "@/db/schema";
import type { HubDistance } from "@/lib/hubs";
import type { SettlementClass } from "@/lib/places";

export type { Reason };

/** A deduped cluster as shown on a feed card / map marker. */
export type ClusterCard = {
  clusterId: number;
  listingId: number;
  source: SourceName;
  sourceId: string;
  url: string | null;

  price: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  memberCount: number;

  propertyKind: string | null;
  usableAreaM2: number | null;
  landAreaM2: number | null;
  disposition: string | null;

  lat: number | null;
  lng: number | null;
  localityText: string | null;
  cadastralName: string | null;

  pricePerUsableM2: number | null;
  pricePerLandM2: number | null;
  /** Asking price minus the plot at local land prices, per usable m². */
  housePricePerUsableM2: number | null;
  percentile: number | null;
  percentileConfidence: string | null;
  priceBasis: PriceBasis | null;
  sampleSize: number | null;

  dealVerdict: "deal" | "fair" | "overpriced" | null;
  isGoodDeal: boolean | null;
  scamScore: number | null;
  scamReasons: Reason[];
  dealReasons: Reason[];
  priceDropPct: number | null;

  photo: string | null;
  photos: string[];
  description: string | null;
  firstSeenAt: string;
  isNew: boolean;

  sellerName: string | null;
  sellerType: string | null;

  distanceKm: number | null;

  /** Distance to the town the listing is lived from (Prague, or Jičín for okres Jičín) + nearest railway station (computed server-side). */
  hub: HubDistance | null;
  nearestStationKm: number | null;
  nearestStationName: string | null;

  /** Settlement size for the listing's locality (computed server-side). */
  population: number | null;
  settlementClass: SettlementClass | null;

  /** Every listing in the cluster — the "also listed at" sources. */
  members: ClusterMember[];
};

export type ClusterMember = {
  source: string;
  sourceId: string;
  url: string | null;
  price: number | null;
};

/** Why a "For you" house was suggested: 0–1 match plus up to three reasons. */
export type SuggestionMatch = { score: number; reasons: string[] };

export type Suggestion = { card: ClusterCard; match: SuggestionMatch };

/** `exampleCount` is how many liked + contacted houses the profile was built from. */
export type SuggestionResult = {
  suggestions: Suggestion[];
  exampleCount: number;
};

export type AreaFacet = { code: string; name: string; count: number };

export type AppConfig = {
  anchor: { lat: number; lng: number; label: string } | null;
  areas: AreaFacet[];
  priceMax: number | null;
  feedWindowHours: number;
};

export type SortKey =
  | "newest"
  | "priceAsc"
  | "priceDesc"
  | "bestDeal"
  | "distance"
  | "hub"
  | "train";
