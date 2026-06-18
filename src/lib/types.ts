import type { Reason } from "@/db/schema";

export type { Reason };

/** A deduped cluster as shown on a feed card / map marker. */
export type ClusterCard = {
  clusterId: number;
  listingId: number;
  source: string;
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
  percentile: number | null;
  percentileConfidence: string | null;
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

  /** Distance to Prague centre + nearest railway station (computed server-side). */
  pragueKm: number | null;
  nearestStationKm: number | null;
  nearestStationName: string | null;

  /** Every listing in the cluster — the "also listed at" sources. */
  members: ClusterMember[];
};

export type ClusterMember = {
  source: string;
  sourceId: string;
  url: string | null;
  price: number | null;
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
  | "distance";
