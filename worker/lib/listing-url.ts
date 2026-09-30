import type { SourceName } from "@/db/schema";

export class ListingImportError extends Error {}

export type ListingTarget = {
  source: SourceName;
  sourceId: string;
  url: string;
};

/** Exact portal allowlist; user input can never select an arbitrary fetch host. */
export function parseListingUrl(input: string): ListingTarget {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ListingImportError(
      "Paste a complete listing URL, starting with https://.",
    );
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new ListingImportError("Use a standard public listing URL.");
  }
  const host = url.hostname.toLowerCase();
  let source: SourceName | undefined;
  let sourceId: string | undefined;
  if (["sreality.cz", "www.sreality.cz"].includes(host)) {
    source = "sreality";
    sourceId = url.pathname.match(
      /^\/detail\/prodej\/dum\/[^/]+\/[^/]+\/(\d+)\/?$/,
    )?.[1];
    url.hostname = "www.sreality.cz";
  } else if (["bezrealitky.cz", "www.bezrealitky.cz"].includes(host)) {
    source = "bezrealitky";
    sourceId = url.pathname.match(
      /^\/nemovitosti-byty-domy\/(\d+)-[^/]+\/?$/,
    )?.[1];
    url.hostname = "www.bezrealitky.cz";
  } else if (["realingo.cz", "www.realingo.cz"].includes(host)) {
    source = "realingo";
    sourceId = url.pathname.match(/^\/prodej\/dum-[^/]+\/(\d+)\/?$/)?.[1];
    url.hostname = "www.realingo.cz";
  } else if (
    [
      "ceskereality.cz",
      "www.ceskereality.cz",
      "stredo.ceskereality.cz",
      "severo.ceskereality.cz",
      "jiho.ceskereality.cz",
      "vychodo.ceskereality.cz",
      "zapado.ceskereality.cz",
      "jiho.moravskereality.cz",
      "severo.moravskereality.cz",
    ].includes(host)
  ) {
    source = "ceskereality";
    sourceId = url.pathname.match(
      /^\/prodej\/rodinne-domy\/.*-(\d+)\.html$/,
    )?.[1];
  }
  if (!source)
    throw new ListingImportError(
      "Supported portals: Sreality, Bezrealitky, České reality and Realingo.",
    );
  if (!sourceId)
    throw new ListingImportError(
      "Open a house for sale and paste its detail-page URL, rather than a search page.",
    );
  url.protocol = "https:";
  url.search = "";
  url.hash = "";
  return { source, sourceId, url: url.href };
}
