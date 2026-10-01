import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchLandPage } from "./land";

test("Sreality plots parse price, area and GPS from the list page", async (context) => {
  const urls: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    return Response.json({
      results: [
        {
          hash_id: 7,
          advert_name: "Prodej stavebního pozemku 1 372 m²",
          price_czk: 1_900_000,
          locality: { gps_lat: 50.31, gps_lon: 15.2, city: "Běchary" },
        },
        {
          hash_id: 8,
          advert_name: "Prodej stavebního pozemku 2030 m²",
          price_czk: 0,
        },
      ],
      pagination: { total: 2 },
    });
  });
  const page = await fetchLandPage("sreality", 2, 1);
  const params = new URL(urls[0]).searchParams;
  assert.equal(params.get("category_main_cb"), "3");
  assert.equal(params.get("category_sub_cb"), "19");
  assert.equal(params.get("locality_district_id"), "30");
  assert.equal(page.isLastPage, true);
  assert.deepEqual(page.plots[0], {
    source: "sreality",
    sourceId: "7",
    price: 1_900_000,
    areaM2: 1372,
    lat: 50.31,
    lng: 15.2,
    localityText: "Běchary",
  });
  // "cena na dotaz" stays unknown rather than 0.
  assert.equal(page.plots[1].price, undefined);
});

test("malformed plot pages throw instead of looking complete", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ errors: ["unavailable"] }),
  );
  await assert.rejects(fetchLandPage("sreality", 0, 1), /unexpected response/);
  await assert.rejects(
    fetchLandPage("bezrealitky", 0, 1),
    /unexpected response/,
  );
});
