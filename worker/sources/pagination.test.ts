import assert from "node:assert/strict";
import { test } from "node:test";
import { createBezrealitkySource } from "./bezrealitky";
import { createCeskeRealitySource } from "./ceskereality";
import { createSrealitySource } from "./sreality";
import { askingPrice } from "./types";

async function collect(source: ReturnType<typeof createSrealitySource>) {
  const items = [];
  for await (const item of source.listPages()) items.push(item);
  return items;
}

test("Sreality resumes with the live offset/limit pagination contract", async (context) => {
  const urls: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    return Response.json({
      results: [{ hash_id: 123, advert_name: "Rodinný dům 120 m²" }],
      pagination: { total: 350 },
    });
  });
  const source = createSrealitySource({
    singlePage: true,
    page: 2,
    regionIndex: 1,
  });
  assert.equal((await collect(source)).length, 1);
  assert.equal(new URL(urls[0]).searchParams.get("offset"), "100");
  assert.equal(new URL(urls[0]).searchParams.get("locality_region_id"), "11");
  assert.equal(urls.length, 1);
  assert.equal(source.completed(), false);
});

test("malformed search responses cannot mark a source crawl complete", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ errors: ["unavailable"] }),
  );
  for (const source of [
    createSrealitySource({ singlePage: true }),
    createBezrealitkySource({ singlePage: true }),
  ]) {
    await assert.rejects(collect(source), /unexpected response/);
    assert.equal(source.completed(), false);
  }
});

test("empty HTML cannot deactivate previously known České reality listings", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>Temporarily unavailable</html>"),
  );
  const source = createCeskeRealitySource({ singlePage: true });
  assert.deepEqual(await collect(source), []);
  assert.equal(source.completed(), false);
});

test("Sreality searches okres Jičín by district id", async (context) => {
  const urls: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    return Response.json({ results: [], pagination: { total: 0 } });
  });
  const source = createSrealitySource({ singlePage: true, regionIndex: 2 });
  await collect(source);
  assert.equal(source.searchCount, 3);
  assert.equal(new URL(urls[0]).searchParams.get("locality_district_id"), "30");
});

test("České reality completes a search on its last page and walks Jičín", async (context) => {
  const urls: string[] = [];
  const card = (id: number) =>
    `<a href="/prodej/rodinne-domy/dum-${id}.html" class="i-estate__image-link"><img alt="Prodej rodinného domu 120 m² Valdice"></a>`;
  context.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    return new Response(`<html>${card(1)}${card(2)}</html>`);
  });
  const source = createCeskeRealitySource({ singlePage: true, regionIndex: 1 });
  const items = await collect(source);
  assert.equal(items.length, 2);
  assert.equal(source.searchCount, 2);
  assert.ok(
    urls[0].startsWith(
      "https://vychodo.ceskereality.cz/prodej/rodinne-domy/jicin/?sff=1&strana=1",
    ),
  );
  assert.equal(
    items[0].url,
    "https://vychodo.ceskereality.cz/prodej/rodinne-domy/dum-1.html",
  );
  assert.equal(source.completed(), true);
});

test("token prices for 'price on request' are unknown, not bargains", () => {
  assert.equal(askingPrice(1), undefined);
  assert.equal(askingPrice(10), undefined);
  assert.equal(askingPrice(undefined), undefined);
  assert.equal(askingPrice(4_990_000.4), 4_990_000);
});
