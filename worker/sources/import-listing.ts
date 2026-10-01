import {
  ListingImportError,
  type ListingTarget,
  parseListingUrl,
} from "../lib/listing-url";
import { parseBezrealitkyDetail } from "./bezrealitky";
import { parseCeskeRealityDetail } from "./ceskereality";
import { parseRealingoDetail } from "./realingo";
import { parseSrealityDetail } from "./sreality";
import { askingPrice, type RawListing } from "./types";

const MAX_BYTES = 5_000_000;

async function fetchDetail(target: ListingTarget): Promise<string> {
  let url =
    target.source === "sreality"
      ? `https://www.sreality.cz/api/v1/estates/${target.sourceId}`
      : target.url;
  const signal = AbortSignal.timeout(20_000);
  for (let redirect = 0; redirect < 4; redirect++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 home-hunter/0.1",
        Accept: "application/json,text/html",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || target.source === "sreality") break;
      const next = parseListingUrl(new URL(location, url).href);
      if (next.source !== target.source || next.sourceId !== target.sourceId)
        break;
      url = next.url;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new ListingImportError(
        response.status === 404 || response.status === 410
          ? "This listing is no longer available."
          : "The portal could not be read right now. Please try again later.",
      );
    }
    const reader = response.body?.getReader();
    if (!reader) break;
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES)
          throw new ListingImportError("This page is too large to analyse.");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new ListingImportError(
    "The portal redirected away from this listing. Copy the current detail-page URL.",
  );
}

export async function importListing(
  target: ListingTarget,
): Promise<RawListing> {
  let text: string;
  try {
    text = await fetchDetail(target);
  } catch (error) {
    if (error instanceof ListingImportError) throw error;
    throw new ListingImportError(
      "The portal did not respond in time. Please try again.",
    );
  }
  let fields: Partial<RawListing>;
  if (target.source === "sreality") {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new ListingImportError(
        "The portal returned an unreadable response.",
      );
    }
    const result =
      body && typeof body === "object" && "result" in body ? body.result : null;
    // Validate category before accepting a numeric ID from a user-controlled URL.
    if (
      !result ||
      typeof result !== "object" ||
      !("category_main_cb" in result) ||
      !("category_type_cb" in result) ||
      !result.category_main_cb ||
      typeof result.category_main_cb !== "object" ||
      !("value" in result.category_main_cb) ||
      result.category_main_cb.value !== 2 ||
      !result.category_type_cb ||
      typeof result.category_type_cb !== "object" ||
      !("value" in result.category_type_cb) ||
      result.category_type_cb.value !== 1
    ) {
      throw new ListingImportError(
        "This link does not point to a house for sale.",
      );
    }
    fields = parseSrealityDetail(result, "large");
  } else if (target.source === "bezrealitky")
    fields = parseBezrealitkyDetail(text, target.sourceId);
  else if (target.source === "realingo")
    fields = parseRealingoDetail(text, target.sourceId);
  else fields = parseCeskeRealityDetail(text);
  if (!fields.description && !fields.usableAreaM2 && !fields.localityText) {
    throw new ListingImportError(
      "No house details could be extracted. The listing may be unavailable or the portal format may have changed.",
    );
  }
  return {
    ...fields,
    ...target,
    price: askingPrice(fields.price),
    photos: (fields.photos ?? [])
      .filter((photo) => /^https:\/\//i.test(photo))
      .slice(0, 30),
  };
}
