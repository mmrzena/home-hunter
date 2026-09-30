import type { PropertyKind, RawListing } from "./types";

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function positive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function coordinate(value: unknown, max: number): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= max
    ? value
    : undefined;
}

function photoUrl(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^offer\/[a-z0-9]+\/[a-z0-9-]+$/i.test(value)
    ? `https://www.realingo.cz/static/images/${value}`
    : undefined;
}

const KINDS: Record<string, PropertyKind> = {
  HOUSE_FAMILY: "rodinny_dum",
  HOUSE_VILLA: "vila",
  HOUSE_COTTAGE: "recreational",
  HOUSE_CABIN: "recreational",
};

/** Read the requested advert only, never the embedded recommendations. */
export function parseRealingoDetail(
  html: string,
  sourceId: string,
): Partial<RawListing> {
  const script = html.match(
    /<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )?.[1];
  if (!script) return {};
  let data: unknown;
  try {
    data = JSON.parse(script);
  } catch {
    return {};
  }
  const props = record(record(data)?.props);
  const store = record(record(props?.pageProps)?.store);
  const details = record(record(store?.offer)?.details);
  const envelope = record(record(details?.[sourceId])?.offer);
  const offer = record(envelope?.offer);
  const detail = record(envelope?.detail);
  if (
    !offer ||
    offer.id !== sourceId ||
    offer.purpose !== "SELL" ||
    offer.property !== "HOUSE" ||
    offer.isLocked === true ||
    envelope?.preview === true ||
    offer.deleted === true ||
    offer.soldOrRented === true
  )
    return {};
  const price = record(offer.price);
  const area = record(offer.area);
  const location = record(offer.location);
  const photos = record(offer.photos);
  const gallery = [
    photos?.main,
    ...(Array.isArray(photos?.list) ? photos.list : []),
  ]
    .map(photoUrl)
    .filter((url): url is string => url !== undefined);
  const contact = record(detail?.contact);
  const company = record(contact?.company);
  const createdAt = text(offer.createdAt);
  const postedAt = createdAt ? new Date(createdAt) : undefined;
  let originalUrl: string | undefined;
  try {
    const url = new URL(text(detail?.externalUrl) ?? "");
    if (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      originalUrl = url.href;
  } catch {
    /* Missing or malformed original link. */
  }
  return {
    price:
      price?.type === "FIXED" && price.currency === "CZK"
        ? positive(price.total)
        : undefined,
    propertyKind:
      typeof offer.category === "string"
        ? (KINDS[offer.category] ?? "other")
        : "other",
    usableAreaM2: positive(area?.floor),
    builtUpAreaM2: positive(area?.built),
    landAreaM2: positive(area?.plot),
    lat: coordinate(location?.latitude, 90),
    lng: coordinate(location?.longitude, 180),
    localityText: text(location?.address),
    description: text(detail?.description),
    sellerName: text(company?.name),
    sellerType: company ? "agency" : undefined,
    photos: [...new Set(gallery)],
    postedAt:
      postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : undefined,
    originalUrl,
  };
}
