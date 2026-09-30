import assert from "node:assert/strict";
import { test } from "node:test";
import { parseListingUrl } from "../lib/listing-url";
import { importListing } from "./import-listing";
import { parseRealingoDetail } from "./realingo";

const OFFER = {
  id: "123",
  purpose: "SELL",
  property: "HOUSE",
  category: "HOUSE_FAMILY",
  price: { type: "FIXED", total: 8_000_000, currency: "CZK" },
  area: { main: 200, floor: 150, plot: 600, built: 100 },
  location: { address: "Praha", latitude: 50.1, longitude: 14.4 },
  photos: {
    main: "offer/abc/abc-1600x900",
    list: ["offer/abc/abc-1600x900", "offer/def/def-1600x900", "../../private"],
  },
  createdAt: "2026-09-01T10:00:00Z",
  deleted: false,
  isLocked: false,
};
const DETAIL = {
  description: "Dům se zahradou.",
  externalUrl: "https://www.sreality.cz/detail/prodej/dum/rodinny/praha/456",
};
function page(offer: unknown = OFFER, detail: unknown = DETAIL) {
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { store: { offer: { details: { "123": { offer: { offer, detail, similar: { items: [{ ...OFFER, id: "999", price: { total: 1 } }] } } } } } } } } })}</script>`;
}

test("Realingo URL support normalizes the domain and rejects non-sale and unsafe links", () => {
  assert.deepEqual(
    parseListingUrl("http://realingo.cz/prodej/dum-rodinny-praha/123?utm=test"),
    {
      source: "realingo",
      sourceId: "123",
      url: "https://www.realingo.cz/prodej/dum-rodinny-praha/123",
    },
  );
  for (const url of [
    "https://www.realingo.cz/prodej_domy/",
    "https://www.realingo.cz/pronajem/dum-rodinny-praha/123",
    "https://www.realingo.cz/prodej/byt-praha/123",
    "https://www.realingo.cz.evil.test/prodej/dum-praha/123",
  ])
    assert.throws(() => parseListingUrl(url));
});

test("extracts the requested house, explicit floor area, coordinates and deduped gallery", () => {
  const result = parseRealingoDetail(page(), "123");
  assert.equal(result.price, 8_000_000);
  assert.equal(result.usableAreaM2, 150);
  assert.equal(result.landAreaM2, 600);
  assert.equal(result.builtUpAreaM2, 100);
  assert.equal(result.lat, 50.1);
  assert.equal(result.propertyKind, "rodinny_dum");
  assert.equal(result.description, DETAIL.description);
  assert.equal(result.originalUrl, DETAIL.externalUrl);
  assert.equal(result.postedAt?.toISOString(), "2026-09-01T10:00:00.000Z");
  assert.equal(result.photos?.length, 2);
  assert.equal(
    result.photos?.[0],
    "https://www.realingo.cz/static/images/offer/abc/abc-1600x900",
  );
  assert.equal(result.sellerType, undefined);
});

test("does not import locked, deleted, sold, rental, or different-property adverts", () => {
  for (const patch of [
    { isLocked: true },
    { deleted: true },
    { soldOrRented: true },
    { purpose: "RENT" },
    { property: "FLAT" },
    { id: "999" },
  ])
    assert.deepEqual(
      parseRealingoDetail(page({ ...OFFER, ...patch }), "123"),
      {},
    );
  assert.deepEqual(parseRealingoDetail(page(), "999"), {});
  assert.deepEqual(
    parseRealingoDetail('<script id="__NEXT_DATA__">bad json</script>', "123"),
    {},
  );
});

test("missing or ambiguous amounts remain unknown rather than becoming a false estimate", () => {
  const result = parseRealingoDetail(
    page(
      {
        ...OFFER,
        price: { type: "ON_REQUEST", total: 1, currency: "CZK" },
        area: { main: 600 },
        location: { latitude: 999 },
        createdAt: "invalid",
      },
      { externalUrl: "javascript:alert(1)" },
    ),
    "123",
  );
  assert.equal(result.price, undefined);
  assert.equal(result.usableAreaM2, undefined);
  assert.equal(result.lat, undefined);
  assert.equal(result.postedAt, undefined);
  assert.equal(result.originalUrl, undefined);
  assert.equal(
    parseRealingoDetail(
      page({
        ...OFFER,
        price: { type: "FIXED", total: 100000, currency: "EUR" },
      }),
      "123",
    ).price,
    undefined,
  );
});

test("single-link import handles Realingo without fetching its external advert", async (context) => {
  const urls: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    return new Response(page());
  });
  const result = await importListing(
    parseListingUrl("https://www.realingo.cz/prodej/dum-rodinny-praha/123"),
  );
  assert.equal(result.source, "realingo");
  assert.equal(result.price, 8_000_000);
  assert.equal(urls.length, 1);
});
