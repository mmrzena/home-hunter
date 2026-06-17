import type { SourceName } from "@/db/schema";

export type PropertyKind = "rodinny_dum" | "vila" | "recreational" | "other";

/** A listing as pulled from a source, before persistence/normalization quirks. */
export type RawListing = {
  source: SourceName;
  sourceId: string;
  url?: string;
  price?: number;
  propertyKind?: PropertyKind;

  usableAreaM2?: number;
  builtUpAreaM2?: number;
  landAreaM2?: number;
  disposition?: string;

  lat?: number;
  lng?: number;
  localityText?: string;

  sellerType?: "private" | "agency";
  sellerName?: string;
  hasIco?: boolean;

  description?: string;
  photos?: string[];
  labels?: string[];
  postedAt?: Date;
};

/**
 * A listings source. `listPages` yields cheap list-level fields (price, gps,
 * photos, name-derived area); `enrich` pulls the per-listing detail (land area,
 * description, seller) used by bucketing + scam scoring. Splitting them lets
 * ingest enrich only new/changed listings and stay within rate limits.
 */
export interface Source {
  name: SourceName;
  listPages(): AsyncGenerator<RawListing>;
  enrich(sourceId: string): Promise<Partial<RawListing>>;
  /** True once listPages paginated to completion (didn't hit the page cap). */
  completed(): boolean;
}
