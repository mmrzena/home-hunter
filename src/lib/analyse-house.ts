import { sql } from "@/db";
import type { Reason } from "@/db/schema";
import type { HouseAnalysis } from "@/lib/analysis-types";
import { anchor } from "@/lib/env";
import { placeInfo } from "@/lib/places";
import {
  distanceToPragueKm,
  haversineKm,
  nearestStations,
} from "@/lib/stations";
import { fastestTrainToPrague } from "@/lib/train-times";
import type { ClusterMember } from "@/lib/types";
import {
  type ListingTarget,
  parseListingUrl,
} from "../../worker/lib/listing-url";
import { getMarketListings } from "../../worker/lib/market-data";
import { PriceModel, sizeBand } from "../../worker/lib/price-model";
import { detectRedPhrase } from "../../worker/lib/red-flags";
import { importListing } from "../../worker/sources/import-listing";

const STATION_COUNT = 3;

type StoredListing = {
  id: number;
  clusterId: number | null;
  firstSeenAt: string;
  scoredAt: string | null;
  scamScore: number | null;
  scamReasons: Reason[] | null;
};

export async function analyseHouse(
  target: ListingTarget,
): Promise<HouseAnalysis> {
  const raw = await importListing(target);
  const { postedAt, ...listing } = raw;
  const hasCoordinates = listing.lat != null && listing.lng != null;
  const lat = listing.lat ?? 0;
  const lng = listing.lng ?? 0;
  const place = placeInfo(
    listing.lat ?? null,
    listing.lng ?? null,
    listing.localityText ?? null,
  );
  const stations = hasCoordinates
    ? nearestStations(lat, lng, STATION_COUNT)
    : [];
  // Runs alongside the market lookups below; it never throws.
  const trainTrips = Promise.all(stations.map(fastestTrainToPrague));
  const result: HouseAnalysis = {
    listing: { ...listing, postedAt: postedAt?.toISOString() },
    fetchedAt: new Date().toISOString(),
    valuation: null,
    comparables: [],
    warnings: [],
    location: {
      pragueKm: hasCoordinates ? distanceToPragueKm(lat, lng) : null,
      stations: [],
      ...place,
      anchorKm:
        hasCoordinates && anchor
          ? haversineKm(lat, lng, anchor.lat, anchor.lng)
          : null,
      anchorLabel: anchor?.label ?? null,
    },
    history: [],
    members: [],
    firstSeenAt: null,
    scoredAt: null,
    storedScamScore: null,
    storedReasons: [],
    descriptionFlag: detectRedPhrase(listing.description ?? null),
    priceDropPct: null,
  };
  if (!(listing.price && listing.price > 0))
    result.warnings.push("The listing does not publish an asking price.");
  if (!(listing.usableAreaM2 && listing.usableAreaM2 > 0))
    result.warnings.push(
      "Usable floor area is missing; price per m² cannot be calculated.",
    );
  if (!hasCoordinates)
    result.warnings.push(
      "The portal did not provide map coordinates. Location comparisons may be limited.",
    );
  if (!listing.landAreaM2)
    result.warnings.push(
      "Plot size is missing, so the model cannot match houses by plot size.",
    );
  try {
    let originalTarget = target;
    if (listing.originalUrl) {
      try {
        originalTarget = parseListingUrl(listing.originalUrl);
      } catch {
        /* Unsupported original portal; no saved identity to look up. */
      }
    }
    const [storedRows, market, areas] = await Promise.all([
      sql<
        StoredListing[]
      >`SELECT id::int, cluster_id::int AS "clusterId", first_seen_at AS "firstSeenAt",
        scored_at AS "scoredAt", scam_score AS "scamScore", scam_reasons AS "scamReasons"
        FROM listings WHERE (source = ${target.source} AND source_id = ${target.sourceId})
          OR (source = ${originalTarget.source} AND source_id = ${originalTarget.sourceId})
        ORDER BY (source = ${target.source}) DESC LIMIT 1`,
      getMarketListings(),
      hasCoordinates
        ? sql<{ code: string }[]>`SELECT code FROM areas
        WHERE ST_Covers(geom, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)) ORDER BY code LIMIT 1`
        : Promise.resolve([]),
    ]);
    const stored = storedRows[0];
    if (stored) {
      result.firstSeenAt = stored.firstSeenAt;
      result.scoredAt = stored.scoredAt;
      result.storedScamScore = stored.scamScore;
      result.storedReasons = stored.scamReasons ?? [];
      const [history, members] = await Promise.all([
        sql<
          HouseAnalysis["history"]
        >`SELECT price::float8 AS price, seen_at AS "seenAt" FROM price_history WHERE listing_id = ${stored.id} AND price > 0 ORDER BY seen_at`,
        stored.clusterId == null
          ? Promise.resolve([])
          : sql<
              ClusterMember[]
            >`SELECT source, source_id AS "sourceId", url, price::float8 AS price FROM listings WHERE cluster_id = ${stored.clusterId} AND is_active ORDER BY price NULLS LAST`,
      ]);
      result.history = history;
      result.members = members;
      const peak = Math.max(0, ...history.map((entry) => entry.price));
      if (listing.price && listing.price > 0 && peak > listing.price)
        result.priceDropPct = (100 * (peak - listing.price)) / peak;
    }
    if (
      listing.price &&
      listing.price > 0 &&
      listing.usableAreaM2 &&
      listing.usableAreaM2 > 0
    ) {
      result.valuation = new PriceModel(market).score({
        id: stored?.id ?? -1,
        clusterId: stored?.clusterId,
        code:
          areas[0]?.code ??
          (listing.localityText ? `loc:${listing.localityText}` : null),
        band: sizeBand(listing.usableAreaM2),
        ppm2: listing.price / listing.usableAreaM2,
        usable: listing.usableAreaM2,
        land: listing.landAreaM2,
        kind: listing.propertyKind,
        lat: listing.lat,
        lng: listing.lng,
      });
      const ids = new Set(result.valuation?.comparableIds ?? []);
      result.comparables = market
        .filter((peer) => ids.has(peer.id))
        .sort((left, right) => {
          if (
            hasCoordinates &&
            left.lat != null &&
            left.lng != null &&
            right.lat != null &&
            right.lng != null
          )
            return (
              haversineKm(lat, lng, left.lat, left.lng) -
              haversineKm(lat, lng, right.lat, right.lng)
            );
          return left.ppm2 - right.ppm2;
        });
      if (!result.valuation)
        result.warnings.push(
          "Not enough recent, similar houses nearby. At least 8 independent comparisons are needed for a price estimate.",
        );
    }
  } catch (error) {
    console.error(
      "House analysis: market data unavailable",
      error instanceof Error ? error.message : "Unknown error",
    );
    result.warnings.push(
      "Market data is unavailable right now. The listing was imported, but price comparisons and history may be incomplete.",
    );
  }
  const trips = await trainTrips;
  result.location.stations = stations.map((station, index) => ({
    ...station,
    train: trips[index],
  }));
  return result;
}
