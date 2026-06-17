import { env } from "@/lib/env";

import { getJson, throttle } from "../lib/http";
import { SREALITY_REGION_IDS } from "../lib/regions";
import type { PropertyKind, RawListing, Source } from "./types";

// The public v2 API is gone; the live site uses /api/v1/estates/search (list)
// and /api/v1/estates/{id} (detail). Shapes verified against the live endpoint.
const SEARCH = "https://www.sreality.cz/api/v1/estates/search";
const DETAIL = "https://www.sreality.cz/api/v1/estates";
const PER_PAGE = 100;

// ── defensive JSON helpers ────────────────────────────────────────────────
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const digits = value.replace(/[^\d]/g, "");
    if (digits.length) return Number(digits);
  }
  return undefined;
}

function stripHtml(html: unknown): string | undefined {
  if (typeof html !== "string") return undefined;
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length ? text : undefined;
}

/** "Prodej rodinného domu 126 m², pozemek 175 m²" → { usable: 126, land: 175 } */
function areasFromName(name: string) {
  const firstM2 = name.match(/(\d[\d\s ]*)\s*m(?:²|2)/);
  const land = name.match(/pozemek\s*(\d[\d\s ]*)\s*m/i);
  return {
    usable: firstM2 ? toNumber(firstM2[1]) : undefined,
    land: land ? toNumber(land[1]) : undefined,
  };
}

function classifyKind(subCb: unknown, name: string): PropertyKind {
  const subName = asRecord(subCb)?.name;
  const sub = typeof subName === "string" ? subName.toLowerCase() : "";
  if (sub.includes("vila")) return "vila";
  if (sub.includes("chat") || sub.includes("chalup")) return "recreational";
  if (sub.includes("rodinn")) return "rodinny_dum";
  const lower = name.toLowerCase();
  if (/(chat|chalup|rekrea)/.test(lower)) return "recreational";
  if (/vil/.test(lower)) return "vila";
  if (/(rodinn|dům|domu|domek|usedlost)/.test(lower)) return "rodinny_dum";
  return "other";
}

function localityText(
  loc: Record<string, unknown> | undefined,
): string | undefined {
  if (!loc) return undefined;
  const district = typeof loc.district === "string" ? loc.district : undefined;
  const part = [loc.citypart, loc.quarter, loc.municipality, loc.city].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (district && part && !part.includes(district))
    return `${district} – ${part}`;
  return part ?? district;
}

// Seznam's sdn.cz CDN hotlink-protects raw image URLs (401). Only whitelisted
// `fl=` derivatives resolve — and they do so referer-free, so the stored URL is
// both hashable here and hot-linkable from the web app. 100px is the available
// size; ample for dHash (downscaled to 9×8) and fine for feed thumbnails.
const SDN_TRANSFORM = "?fl=res,100,100,1|jpg,80";

function sdnTransform(url: string): string {
  return url.includes("sdn.cz") && !url.includes("?")
    ? `${url}${SDN_TRANSFORM}`
    : url;
}

/**
 * Image arrays come in three shapes: bare strings (advert_images), detail
 * {url} objects, and advert_images_all {advert_image_sdn_url} objects (the full
 * gallery — preferred, since more images = stronger pHash dedupe).
 */
function imageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      const record = asRecord(entry);
      return (record?.url ?? record?.advert_image_sdn_url) as
        | string
        | undefined;
    })
    .filter((url): url is string => typeof url === "string")
    .map((url) => sdnTransform(url.startsWith("//") ? `https:${url}` : url));
}

const SUB_SLUG: Record<PropertyKind, string> = {
  vila: "vila",
  recreational: "chata",
  rodinny_dum: "rodinny",
  other: "rodinny",
};

/**
 * Public detail URL: /detail/prodej/dum/{sub}/{locality-slug}/{hash_id}.
 * Sreality resolves by hash_id and 301-redirects to the canonical slug, so the
 * slug only needs to be present — but the `sub` segment must be a real keyword
 * (rodinny/vila/chata), or the page 404s.
 */
function detailUrl(
  kind: PropertyKind,
  locality: Record<string, unknown> | undefined,
  hashId: unknown,
): string {
  const slug =
    [
      locality?.city_seo_name ?? locality?.district_seo_name,
      locality?.citypart_seo_name ??
        locality?.municipality_seo_name ??
        locality?.quarter_seo_name,
      locality?.street_seo_name,
    ]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      )
      .join("-") || "x";
  return `https://www.sreality.cz/detail/prodej/dum/${SUB_SLUG[kind]}/${slug}/${hashId}`;
}

// ── source ────────────────────────────────────────────────────────────────
export function createSrealitySource(): Source {
  const pace = throttle(env.REQUEST_DELAY_MS);
  let didComplete = false;

  async function* listPages(): AsyncGenerator<RawListing> {
    let completedAll = true;

    for (const regionId of SREALITY_REGION_IDS) {
      let page = 1;
      while (page <= env.INGEST_MAX_PAGES) {
        await pace();
        const url =
          `${SEARCH}?category_main_cb=2&category_type_cb=1&per_page=${PER_PAGE}` +
          `&page=${page}&locality_region_id=${regionId}`;
        const body = asRecord(await getJson(url));
        const results = Array.isArray(body?.results) ? body.results : [];
        if (results.length === 0) break;

        for (const raw of results) {
          const estate = asRecord(raw);
          const hashId = estate?.hash_id;
          if (hashId === undefined || hashId === null) continue;
          const name =
            typeof estate?.advert_name === "string" ? estate.advert_name : "";
          const locality = asRecord(estate?.locality);
          const { usable, land } = areasFromName(name);
          const price = toNumber(estate?.price_czk ?? estate?.price);
          const isAgency = Boolean(estate?.premise_id ?? estate?.premise);
          const allImages = imageUrls(estate?.advert_images_all);
          const photos = allImages.length
            ? allImages
            : imageUrls(estate?.advert_images);
          const kind = classifyKind(estate?.category_sub_cb, name);

          yield {
            source: "sreality",
            sourceId: String(hashId),
            url: detailUrl(kind, locality, hashId),
            price: price !== undefined ? Math.round(price) : undefined,
            propertyKind: kind,
            usableAreaM2: usable,
            landAreaM2: land,
            lat: toNumber(locality?.gps_lat),
            lng: toNumber(locality?.gps_lon),
            localityText: localityText(locality),
            sellerType: isAgency ? "agency" : "private",
            photos,
            labels: [],
          };
        }

        const pagination = asRecord(body?.pagination);
        const total = toNumber(pagination?.total) ?? 0;
        if (page * PER_PAGE >= total) break;
        if (page === env.INGEST_MAX_PAGES) completedAll = false;
        page += 1;
      }
    }
    didComplete = completedAll;
  }

  async function enrich(sourceId: string): Promise<Partial<RawListing>> {
    await pace();
    const detail = asRecord(
      asRecord(await getJson(`${DETAIL}/${sourceId}`))?.result,
    );
    if (!detail) return {};

    const out: Partial<RawListing> = {};
    out.description = stripHtml(detail.advert_description);
    out.usableAreaM2 = toNumber(detail.usable_area);
    out.landAreaM2 = toNumber(detail.estate_area ?? detail.garden_area);
    out.builtUpAreaM2 = toNumber(detail.building_area ?? detail.floor_area);

    const rooms = asRecord(detail.room_count_cb)?.name;
    if (typeof rooms === "string") out.disposition = rooms;

    const since = detail.since ?? detail.beginning_date;
    if (typeof since === "string") {
      const date = new Date(since);
      if (!Number.isNaN(date.getTime())) out.postedAt = date;
    }

    const premise = asRecord(detail.premise);
    const ico = asRecord(premise?.company)?.company_ic;
    if (premise) {
      out.sellerType = "agency";
      out.hasIco = Boolean(ico);
      const name = premise.name ?? premise.seo_name;
      if (typeof name === "string") out.sellerName = name;
    } else {
      out.sellerType = "private";
      out.hasIco = false;
    }

    const labels: string[] = [];
    if (detail.exclusively_at_rk === true) labels.push("EXCLUSIVE");
    const oldPrice = toNumber(
      detail.price_summary_old_czk ?? detail.price_summary_old,
    );
    const price = toNumber(detail.price_czk);
    if (oldPrice && price && oldPrice > price) labels.push("LOWERED_PRICE");
    out.labels = labels;

    return out;
  }

  return {
    name: "sreality",
    listPages,
    enrich,
    completed: () => didComplete,
  };
}
