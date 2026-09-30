import assert from "node:assert/strict";
import { test } from "node:test";
import { createBezrealitkySource } from "./bezrealitky";
import { createCeskeRealitySource } from "./ceskereality";
import { createSrealitySource } from "./sreality";

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
