import assert from "node:assert/strict";
import { test } from "node:test";
import { parseListingUrl } from "../lib/listing-url";
import { parseBezrealitkyDetail } from "./bezrealitky";
import { parseCeskeRealityDetail } from "./ceskereality";
import { importListing } from "./import-listing";
import { parseSrealityDetail } from "./sreality";

const URL = "https://www.sreality.cz/detail/prodej/dum/rodinny/praha/123";

test("accepts supported detail pages and removes tracking parameters", () => {
  assert.deepEqual(parseListingUrl(`${URL}?campaign=abc#photos`), {
    source: "sreality",
    sourceId: "123",
    url: URL,
  });
  assert.equal(
    parseListingUrl(
      "https://www.bezrealitky.cz/nemovitosti-byty-domy/123-nabidka-prodej-domu-praha",
    ).source,
    "bezrealitky",
  );
  assert.equal(
    parseListingUrl(
      "https://stredo.ceskereality.cz/prodej/rodinne-domy/dum-123.html",
    ).sourceId,
    "123",
  );
});

test("rejects arbitrary hosts, credentials, ports, search pages and rentals", () => {
  for (const url of [
    "http://127.0.0.1/detail/123",
    "https://sreality.cz.evil.test/detail/123",
    "https://evil.sreality.cz/detail/123",
    URL.replace("https://", "https://user:pass@"),
    URL.replace(".cz/", ".cz:444/"),
    "file:///etc/passwd",
    "https://www.sreality.cz/hledani",
    URL.replace("prodej", "pronajem"),
  ])
    assert.throws(() => parseListingUrl(url));
});

test("Sreality detail supplies price, coordinates, areas and gallery without a search crawl", () => {
  const listing = parseSrealityDetail({
    hash_id: 123,
    advert_name: "Prodej rodinného domu",
    category_sub_cb: { name: "Rodinný" },
    price_summary_czk: 6_000_000,
    usable_area: 120,
    estate_area: 650,
    locality: { gps_lat: 50.1234, gps_lon: 14.4321, city: "Praha" },
    advert_images: [{ url: "//d18-a.sdn.cz/house.jpg" }],
  });
  assert.equal(listing.price, 6_000_000);
  assert.equal(listing.usableAreaM2, 120);
  assert.equal(listing.lat, 50.1234);
  assert.equal(listing.photos?.length, 1);
  assert.equal(listing.propertyKind, "rodinny_dum");
});

test("Bezrealitky resolves the selected advert's images, excluding related adverts", () => {
  const advert = {
    estateType: "DUM",
    offerType: "PRODEJ",
    currency: "CZK",
    active: true,
    price: 7_000_000,
    surface: 140,
    surfaceLand: 500,
    publicImages: [{ __ref: "Image:one" }],
  };
  const html = (value: unknown) =>
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { apolloCache: { "Advert:123": value, "Advert:999": { price: 1 }, "Image:one": { 'url({"filter":"RECORD_MAIN"})': "https://api.bezrealitky.cz/one.jpg" } } } } })}</script>`;
  assert.equal(parseBezrealitkyDetail(html(advert), "123").price, 7_000_000);
  assert.deepEqual(parseBezrealitkyDetail(html(advert), "123").photos, [
    "https://api.bezrealitky.cz/one.jpg",
  ]);
  for (const change of [
    { currency: "EUR" },
    { offerType: "PRONAJEM" },
    { active: false },
    { estateType: "BYT" },
  ])
    assert.deepEqual(
      parseBezrealitkyDetail(html({ ...advert, ...change }), "123"),
      {},
    );
  assert.deepEqual(parseBezrealitkyDetail("<html>blocked</html>", "123"), {});
});

test("České reality reads purchase price and explicit plot size, not numbers from description", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "individualProduct", additionalType: "House", name: "Prodej rodinného domu 120 m²", offers: { "@type": "OfferForPurchase", priceCurrency: "CZK", price: 5_000_000 }, description: "Zahrada 999 m&sup2;." })}</script><span class="i-info__title">Plocha pozemku</span><span class="i-info__value">650 m²</span>`;
  assert.equal(parseCeskeRealityDetail(html).price, 5_000_000);
  assert.equal(parseCeskeRealityDetail(html).landAreaM2, 650);
  assert.equal(parseCeskeRealityDetail(html).description, "Zahrada 999 m².");
  assert.deepEqual(
    parseCeskeRealityDetail(
      '<script type="application/ld+json">invalid</script>',
    ),
    {},
  );
});

test("import refuses redirects to internal hosts without following them", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/private" },
    });
  });
  await assert.rejects(
    importListing(
      parseListingUrl(
        "https://www.bezrealitky.cz/nemovitosti-byty-domy/123-house",
      ),
    ),
  );
  assert.equal(calls, 1);
});

test("import rejects rental data behind a sale-shaped URL", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({
      result: {
        category_main_cb: { value: 2 },
        category_type_cb: { value: 2 },
        price_czk: 30_000,
        usable_area: 120,
      },
    }),
  );
  await assert.rejects(importListing(parseListingUrl(URL)), /house for sale/);
});
