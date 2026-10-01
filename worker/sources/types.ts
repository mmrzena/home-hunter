import type { SourceName } from "@/db/schema";

export type PropertyKind = "rodinny_dum" | "vila" | "recreational" | "other";

/** A listing as pulled from a source, before persistence/normalization quirks. */
export type RawListing = {
  source: SourceName;
  sourceId: string;
  url?: string;
  /** Original advert linked by an aggregator; used to find existing tracking. */
  originalUrl?: string;
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
export type PageOptions = {
  page?: number;
  regionIndex?: number;
  singlePage?: boolean;
};

/**
 * Portals use token amounts ("1 Kč", "10 Kč") for price on request. Anything
 * below this is not a real house price, so it's stored as unknown.
 */
export const MIN_ASKING_PRICE = 100_000;

export function askingPrice(price: number | undefined): number | undefined {
  return price !== undefined && price >= MIN_ASKING_PRICE
    ? Math.round(price)
    : undefined;
}

/** The one search a single-page crawl step covers, or every search for a full crawl. */
export function searchesFor<T>(
  searches: readonly T[],
  options: PageOptions,
): readonly T[] {
  if (!options.singlePage) return searches;
  const index = options.regionIndex ?? 0;
  return searches.slice(index, index + 1);
}

export interface Source {
  name: SourceName;
  /** Separate searches (regions/districts) one crawl walks; `PageOptions.regionIndex` picks one. */
  searchCount: number;
  listPages(): AsyncGenerator<RawListing>;
  enrich(sourceId: string, url?: string): Promise<Partial<RawListing>>;
  /** True once listPages paginated to completion (didn't hit the page cap). */
  completed(): boolean;
}
