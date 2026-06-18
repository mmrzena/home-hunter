import { env } from "@/lib/env";

import { postJson, throttle } from "../lib/http";
import type { PropertyKind, RawListing, Source } from "./types";

// Bezrealitky's public GraphQL. The query is `listAdverts` (returns
// AdvertList { list, totalCount }); one call carries everything we need —
// price, areas, gps, gallery, description — so there's no separate detail fetch.
// Region filter uses OSM relation ids in their `R`-prefixed form (verified live):
// Praha = R435514, Středočeský kraj = R442397.
const ENDPOINT = "https://api.bezrealitky.cz/graphql/";
const REGION_OSM_IDS = ["R435514", "R442397"] as const;
const PER_PAGE = 100;
const DETAIL_BASE = "https://www.bezrealitky.cz/nemovitosti-byty-domy";

const LIST_QUERY = `query Adverts($regions: [ID], $limit: Int, $offset: Int) {
  listAdverts(
    offerType: [PRODEJ]
    estateType: [DUM]
    regionOsmIds: $regions
    limit: $limit
    offset: $offset
    order: TIMEORDER_DESC
  ) {
    totalCount
    list {
      id
      uri
      title
      description
      price
      originalPrice
      surface
      surfaceLand
      disposition
      gps { lat lng }
      address(locale: CS)
      city(locale: CS)
      cityDistrict(locale: CS)
      mainImage { url(filter: RECORD_MAIN) }
      publicImages { url(filter: RECORD_THUMB) }
      broker { id }
    }
  }
}`;

// ── defensive JSON helpers ────────────────────────────────────────────────
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function toText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** "DISP_5_KK" → "5+kk", "DISP_3_1" → "3+1"; unknown shapes pass through. */
function disposition(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("DISP_")) return undefined;
  const [num, kind] = value.slice(5).split("_");
  if (!num) return undefined;
  if (kind === "KK") return `${num}+kk`;
  if (kind) return `${num}+${kind}`;
  return num;
}

function classifyKind(title: string): PropertyKind {
  const lower = title.toLowerCase();
  if (/vil/.test(lower)) return "vila";
  if (/(chat|chalup|rekrea)/.test(lower)) return "recreational";
  return "rodinny_dum";
}

/** mainImage + the full gallery, deduped, main first — all hot-linkable. */
function imageUrls(advert: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const main = asRecord(advert.mainImage)?.url;
  if (typeof main === "string") urls.push(main);
  const gallery = advert.publicImages;
  if (Array.isArray(gallery)) {
    for (const entry of gallery) {
      const url = asRecord(entry)?.url;
      if (typeof url === "string") urls.push(url);
    }
  }
  return [...new Set(urls)];
}

type ListResponse = {
  data?: { listAdverts?: { totalCount?: unknown; list?: unknown } };
};

export function createBezrealitkySource(): Source {
  const pace = throttle(env.REQUEST_DELAY_MS);
  let didComplete = false;

  async function* listPages(): AsyncGenerator<RawListing> {
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    let page = 0;
    let completedAll = true;

    while (offset < total) {
      if (page >= env.INGEST_MAX_PAGES) {
        completedAll = false;
        break;
      }
      await pace();
      const body = await postJson<ListResponse>(ENDPOINT, {
        query: LIST_QUERY,
        variables: { regions: REGION_OSM_IDS, limit: PER_PAGE, offset },
      });
      const result = asRecord(body?.data?.listAdverts);
      const list = Array.isArray(result?.list) ? result.list : [];
      total = toNumber(result?.totalCount) ?? list.length;
      if (list.length === 0) break;

      for (const raw of list) {
        const advert = asRecord(raw);
        const id = advert?.id;
        if (id === undefined || id === null) continue;
        const title = toText(advert?.title) ?? "";
        const gps = asRecord(advert?.gps);
        const uri = toText(advert?.uri);
        const broker = asRecord(advert?.broker);
        const isAgency = broker != null;

        yield {
          source: "bezrealitky",
          sourceId: String(id),
          url: uri ? `${DETAIL_BASE}/${uri}` : undefined,
          price: toNumber(advert?.price),
          propertyKind: classifyKind(title),
          usableAreaM2: toNumber(advert?.surface),
          landAreaM2: toNumber(advert?.surfaceLand),
          disposition: disposition(advert?.disposition),
          lat: toNumber(gps?.lat),
          lng: toNumber(gps?.lng),
          localityText:
            toText(advert?.cityDistrict) ??
            toText(advert?.city) ??
            toText(advert?.address),
          sellerType: isAgency ? "agency" : "private",
          hasIco: isAgency,
          description: toText(advert?.description),
          photos: imageUrls(advert ?? {}),
          labels: priceLabels(advert),
        };
      }

      offset += list.length;
      page += 1;
    }
    didComplete = completedAll;
  }

  // Everything ships in the list query, so there's nothing left to enrich.
  async function enrich(): Promise<Partial<RawListing>> {
    return {};
  }

  return {
    name: "bezrealitky",
    listPages,
    enrich,
    completed: () => didComplete,
  };
}

function priceLabels(advert: Record<string, unknown> | undefined): string[] {
  const price = toNumber(advert?.price);
  const original = toNumber(advert?.originalPrice);
  return original && price && original > price ? ["LOWERED_PRICE"] : [];
}
