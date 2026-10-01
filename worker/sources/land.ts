import { getJson, postJson } from "../lib/http";
import { SREALITY_LOCALITIES } from "../lib/regions";
import { ENDPOINT, REGION_OSM_IDS } from "./bezrealitky";

/**
 * Building plots for sale (stavební parcely), crawled only to price land
 * locally. List pages carry price, plot area and GPS, so there is no detail
 * fetch. Parsing is defensive; a malformed page throws so an incomplete crawl
 * can never deactivate known plots.
 */
export const LAND_SOURCES = ["sreality", "bezrealitky"] as const;
export type LandSource = (typeof LAND_SOURCES)[number];

export type LandPlot = {
  source: LandSource;
  sourceId: string;
  price?: number;
  areaM2?: number;
  lat?: number;
  lng?: number;
  localityText?: string;
};
export type LandPage = { plots: LandPlot[]; isLastPage: boolean };

const SREALITY_SEARCH = "https://www.sreality.cz/api/v1/estates/search";
const PER_PAGE = 100;

export const LAND_SEARCH_COUNT: Record<LandSource, number> = {
  sreality: SREALITY_LOCALITIES.length,
  bezrealitky: 1,
};

const BEZREALITKY_QUERY = `query Plots($regions: [ID], $limit: Int, $offset: Int) {
  listAdverts(
    offerType: [PRODEJ]
    estateType: [POZEMEK]
    landType: [STAVEBNI]
    regionOsmIds: $regions
    limit: $limit
    offset: $offset
  ) {
    totalCount
    list { id price surfaceLand gps { lat lng } city(locale: CS) }
  }
}`;

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

/** "Prodej stavebního pozemku 1 372 m²" → 1372 */
function areaFromName(name: unknown): number | undefined {
  if (typeof name !== "string") return undefined;
  const match = name.match(/(\d[\d\s ]*)\s*m(?:²|2)/);
  return match ? toNumber(match[1]) : undefined;
}

function positive(value: number | undefined): number | undefined {
  return value !== undefined && value > 0 ? Math.round(value) : undefined;
}

// Below this a plot "price" is a placeholder for price on request ("1 Kč").
const MIN_PLOT_PRICE = 20_000;

function plotPrice(value: number | undefined): number | undefined {
  return value !== undefined && value >= MIN_PLOT_PRICE
    ? Math.round(value)
    : undefined;
}

async function srealityPage(
  searchIndex: number,
  page: number,
): Promise<LandPage> {
  const locality = SREALITY_LOCALITIES[searchIndex];
  const url =
    `${SREALITY_SEARCH}?category_main_cb=3&category_type_cb=1&category_sub_cb=19` +
    `&limit=${PER_PAGE}&offset=${(page - 1) * PER_PAGE}&${locality.param}=${locality.id}`;
  const body = asRecord(await getJson(url));
  const pagination = asRecord(body?.pagination);
  if (!Array.isArray(body?.results) || typeof pagination?.total !== "number")
    throw new Error("Sreality plot search returned an unexpected response");
  const total = pagination.total;
  if (body.results.length === 0 && total > (page - 1) * PER_PAGE)
    throw new Error("Sreality returned an empty plot page before the end");
  const plots: LandPlot[] = [];
  for (const raw of body.results) {
    const estate = asRecord(raw);
    const hashId = estate?.hash_id;
    if (hashId === undefined || hashId === null) continue;
    const place = asRecord(estate?.locality);
    plots.push({
      source: "sreality",
      sourceId: String(hashId),
      price: plotPrice(toNumber(estate?.price_czk ?? estate?.price)),
      areaM2: positive(areaFromName(estate?.advert_name)),
      lat: toNumber(place?.gps_lat),
      lng: toNumber(place?.gps_lon),
      localityText: typeof place?.city === "string" ? place.city : undefined,
    });
  }
  return { plots, isLastPage: page * PER_PAGE >= total };
}

async function bezrealitkyPage(page: number): Promise<LandPage> {
  const offset = (page - 1) * PER_PAGE;
  const body = asRecord(
    await postJson(ENDPOINT, {
      query: BEZREALITKY_QUERY,
      variables: { regions: REGION_OSM_IDS, limit: PER_PAGE, offset },
    }),
  );
  const result = asRecord(asRecord(body?.data)?.listAdverts);
  if (!Array.isArray(result?.list) || typeof result?.totalCount !== "number")
    throw new Error("Bezrealitky plot search returned an unexpected response");
  const plots: LandPlot[] = [];
  for (const raw of result.list) {
    const advert = asRecord(raw);
    const id = advert?.id;
    if (id === undefined || id === null) continue;
    const gps = asRecord(advert?.gps);
    plots.push({
      source: "bezrealitky",
      sourceId: String(id),
      price: plotPrice(toNumber(advert?.price)),
      areaM2: positive(toNumber(advert?.surfaceLand)),
      lat: toNumber(gps?.lat),
      lng: toNumber(gps?.lng),
      localityText: typeof advert?.city === "string" ? advert.city : undefined,
    });
  }
  return {
    plots,
    isLastPage:
      result.list.length === 0 ||
      offset + result.list.length >= result.totalCount,
  };
}

export function fetchLandPage(
  source: LandSource,
  searchIndex: number,
  page: number,
): Promise<LandPage> {
  return source === "sreality"
    ? srealityPage(searchIndex, page)
    : bezrealitkyPage(page);
}
