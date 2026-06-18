import { env } from "@/lib/env";

import { getText, throttle } from "../lib/http";
import type { PropertyKind, RawListing, Source } from "./types";

/**
 * České reality (regional subdomains). No JSON API: the search pages are scraped
 * for the reliable, adjacent fields (id, detail URL, kind, area, locality,
 * thumbnail), and the per-listing detail page — which carries a structured
 * `individualProduct` JSON-LD block plus map coordinates — is parsed in `enrich`
 * for GPS, description, and the gallery. The list pass carries the card price so
 * the ingest gate can detect changes and re-enrich (price drops refresh like the
 * other sources). Every parse is defensive: a missing field yields `undefined`,
 * never a throw, so a markup change degrades gracefully rather than crashing.
 */
// "Střední Čechy" on České reality covers both target regions — it includes
// the praha-hlavni-mesto sub-filter alongside the Středočeský districts — so
// this one subdomain spans Praha + Středočeský. (There is no praha.* subdomain;
// the regional sites are compass-based: stredo / severo / jiho / vychodo / zapado.)
const BASES = ["https://stredo.ceskereality.cz"] as const;
const SEARCH_PATH = "/prodej/rodinne-domy/?sff=1";

// Each card opens with its image-link anchor (id in the URL tail); slicing from
// one anchor to the next bounds a single card, so the thumbnail, alt, and footer
// price found inside the slice all belong to that listing.
const CARD_ANCHOR_RE =
  /<a\s+href="(\/prodej\/rodinne-domy\/[^"]+?-(\d+)\.html)"[^>]*\bclass="[^"]*i-estate__image-link/g;
const ALT_RE = /alt="([^"]*)"/;
const PHOTO_RE = /src="(https:\/\/img-cache\.ceskereality\.cz\/[^"]+?\.jpg)"/;
const PRICE_RE = /i-estate__footer-price-value"\s*>\s*([\d\s ]+)\s*K/;

function classifyKind(alt: string): PropertyKind {
  const lower = alt.toLowerCase();
  if (/(chat|chalup|rekrea)/.test(lower)) return "recreational";
  if (/vil/.test(lower)) return "vila";
  return "rodinny_dum";
}

/** "Prodej rodinného domu 96 m² Hřiměždice" → { area: 96, locality: "Hřiměždice" } */
function parseAlt(alt: string): { area?: number; locality?: string } {
  const areaMatch = alt.match(/(\d{2,4})\s*m[²2]/);
  const area = areaMatch ? Number(areaMatch[1]) : undefined;
  const after = alt.split(/m[²2]\s*/)[1];
  const locality = after?.trim();
  return {
    area,
    locality: locality && locality.length > 0 ? locality : undefined,
  };
}

const NAMED_ENTITIES: Record<string, string> = {
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  yacute: "ý",
  ccaron: "č",
  dcaron: "ď",
  ecaron: "ě",
  ncaron: "ň",
  rcaron: "ř",
  scaron: "š",
  tcaron: "ť",
  uring: "ů",
  zcaron: "ž",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Yacute: "Ý",
  Ccaron: "Č",
  Dcaron: "Ď",
  Ecaron: "Ě",
  Ncaron: "Ň",
  Rcaron: "Ř",
  Scaron: "Š",
  Tcaron: "Ť",
  Uring: "Ů",
  Zcaron: "Ž",
  nbsp: " ",
  amp: "&",
  quot: '"',
  lt: "<",
  gt: ">",
  apos: "'",
};

/** Decode the HTML entities České reality uses in its JSON-LD description. */
function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-zA-Z]+);/g, (whole, name) => NAMED_ENTITIES[name] ?? whole);
}

function cleanDescription(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = decodeEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text : undefined;
}

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

/** The first `individualProduct` JSON-LD block on a detail page, parsed. */
function productLd(html: string): Record<string, unknown> | undefined {
  const blocks = html.matchAll(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  );
  for (const block of blocks) {
    try {
      const parsed = asRecord(JSON.parse(block[1]));
      if (parsed?.["@type"] === "individualProduct") return parsed;
    } catch {
      // malformed block — skip it
    }
  }
  return undefined;
}

/** Map coordinates appear as `lat`/`lng`(`lon`) numbers in the page markup. */
function parseGps(html: string): { lat?: number; lng?: number } {
  const lat = html.match(/lat(?:itude)?["':=\s]{1,4}(\d{1,2}\.\d{3,})/i);
  const lng = html.match(
    /(?:lng|lon)(?:gitude)?["':=\s]{1,4}(\d{1,2}\.\d{3,})/i,
  );
  return {
    lat: lat ? Number(lat[1]) : undefined,
    lng: lng ? Number(lng[1]) : undefined,
  };
}

/** Gallery image URLs, normalized to one size so duplicates collapse. */
function galleryPhotos(html: string, ldImage: unknown): string[] {
  const raw = [
    ...html.matchAll(
      /https:\/\/img-cache\.ceskereality\.cz\/[^\s"'<>]+?\.jpg/g,
    ),
  ].map((match) => match[0].replace(/\/\d+x\d+_jpg\//, "/640x640_jpg/"));
  if (typeof ldImage === "string") raw.unshift(ldImage);
  return [...new Set(raw)].slice(0, env.MAX_IMAGES_PER_LISTING);
}

export function createCeskeRealitySource(): Source {
  const pace = throttle(env.REQUEST_DELAY_MS);
  const detailUrlById = new Map<string, string>();
  let didComplete = false;

  async function* listPages(): AsyncGenerator<RawListing> {
    let completedAll = true;

    for (const base of BASES) {
      let page = 1;
      while (page <= env.INGEST_MAX_PAGES) {
        await pace();
        let html: string;
        try {
          html = await getText(`${base}${SEARCH_PATH}&strana=${page}`);
        } catch (error) {
          console.warn(`ceskereality ${base} page ${page} failed:`, error);
          break;
        }

        const anchors = [...html.matchAll(CARD_ANCHOR_RE)];
        const seen = new Set<string>();
        for (let index = 0; index < anchors.length; index += 1) {
          const [, path, id] = anchors[index];
          if (seen.has(id)) continue;
          seen.add(id);

          // Slice this card (anchor → next anchor) so its alt/photo/price are
          // unambiguous, then carry the list-level price so the ingest gate can
          // detect changes and re-enrich (a price drop refreshes properly).
          const start = anchors[index].index ?? 0;
          const end = anchors[index + 1]?.index ?? html.length;
          const card = html.slice(start, end);
          const alt = ALT_RE.exec(card)?.[1] ?? "";
          const photo = PHOTO_RE.exec(card)?.[1];
          const priceDigits = PRICE_RE.exec(card)?.[1]?.replace(/\D/g, "");
          const price = priceDigits ? Number(priceDigits) : undefined;

          const kind = classifyKind(alt);
          const { area, locality } = parseAlt(alt);
          const url = `${base}${path}`;
          detailUrlById.set(id, url);

          yield {
            source: "ceskereality",
            sourceId: id,
            url,
            price,
            propertyKind: kind,
            usableAreaM2: area,
            localityText: locality,
            sellerType: "agency",
            photos: photo ? [photo] : [],
            labels: [],
          };
        }

        if (seen.size === 0) break;
        if (page === env.INGEST_MAX_PAGES) completedAll = false;
        page += 1;
      }
    }
    didComplete = completedAll;
  }

  async function enrich(sourceId: string): Promise<Partial<RawListing>> {
    const url = detailUrlById.get(sourceId);
    if (!url) return {};
    await pace();
    let html: string;
    try {
      html = await getText(url);
    } catch {
      return {};
    }

    const out: Partial<RawListing> = {};
    const product = productLd(html);
    const offers = asRecord(product?.offers);
    out.price = toNumber(offers?.price);
    out.description = cleanDescription(product?.description);

    const locality = asRecord(
      asRecord(offers?.areaServed)?.address,
    )?.addressLocality;
    if (typeof locality === "string" && locality.length > 0)
      out.localityText = locality;

    const name = typeof product?.name === "string" ? product.name : "";
    const area = name.match(/(\d{2,4})\s*m[²2]/);
    if (area) out.usableAreaM2 = Number(area[1]);

    const { lat, lng } = parseGps(html);
    if (lat !== undefined && lng !== undefined) {
      out.lat = lat;
      out.lng = lng;
    }

    const photos = galleryPhotos(html, product?.image);
    if (photos.length > 0) out.photos = photos;

    return out;
  }

  return {
    name: "ceskereality",
    listPages,
    enrich,
    completed: () => didComplete,
  };
}
