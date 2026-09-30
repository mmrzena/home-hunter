import assert from "node:assert/strict";
import { test } from "node:test";
import { PriceModel, type Sample } from "./price-model";

const SUBJECT: Sample = {
  id: 1,
  clusterId: 1,
  code: "local",
  band: "120-200",
  ppm2: 50_000,
  kind: "rodinny_dum",
  usable: 150,
  land: 600,
  lat: 50,
  lng: 14.4,
};
function peers(count = 8): Sample[] {
  return Array.from({ length: count }, (_, index) => ({
    ...SUBJECT,
    id: index + 10,
    clusterId: index + 10,
    ppm2: 40_000 + index * 5_000,
  }));
}

test("excludes the subject and all its known duplicate adverts", () => {
  const data = peers(7);
  assert.equal(
    new PriceModel([...data, SUBJECT, { ...SUBJECT, id: 2 }]).score(SUBJECT),
    null,
  );
});

test("counts each independent house once", () => {
  const data = peers();
  const result = new PriceModel([
    ...data,
    ...data.map((peer) => ({
      ...peer,
      id: peer.id + 100,
      ppm2: peer.ppm2 + 1000,
    })),
  ]).score(SUBJECT);
  assert.equal(result?.sampleSize, 8);
  assert.equal(result?.medianPpm2, 57_500);
  assert.equal(result?.lowerPpm2, 48_750);
  assert.equal(result?.upperPpm2, 66_250);
  assert.equal(result?.percentile, 31.25);
});

test("rejects invalid prices, other types, dissimilar sizes and plots", () => {
  for (const change of [
    { ppm2: Number.NaN },
    { ppm2: -1 },
    { ppm2: Number.POSITIVE_INFINITY },
    { kind: "recreational" },
    { usable: 400 },
    { land: 10_000 },
  ]) {
    assert.equal(
      new PriceModel(peers().map((peer) => ({ ...peer, ...change }))).score(
        SUBJECT,
      ),
      null,
    );
  }
  assert.equal(new PriceModel(peers()).score({ ...SUBJECT, ppm2: 0 }), null);
});

test("uses local geography across locality boundaries without crossing remote markets", () => {
  const result = new PriceModel(
    peers().map((peer) => ({ ...peer, code: "next-village", lat: 50.02 })),
  ).score(SUBJECT);
  assert.equal(result?.bucketKey, "radius:5km");
  assert.equal(
    new PriceModel(
      peers().map((peer) => ({ ...peer, code: "remote", lat: 49 })),
    ).score(SUBJECT),
    null,
  );
});

test("missing coordinates can use the same locality; missing all location cannot", () => {
  assert.equal(
    new PriceModel(peers()).score({ ...SUBJECT, lat: null, lng: null })
      ?.sampleSize,
    8,
  );
  assert.equal(
    new PriceModel(peers()).score({
      ...SUBJECT,
      code: null,
      lat: null,
      lng: null,
    }),
    null,
  );
});

test("high confidence requires depth, tight distribution, and known property and plot data", () => {
  const data = peers(20).map((peer) => ({ ...peer, ppm2: 50_000 }));
  assert.equal(new PriceModel(data).score(SUBJECT)?.confidence, "high");
  assert.equal(new PriceModel(data).score(SUBJECT)?.percentile, 50);
  assert.equal(
    new PriceModel(data).score({ ...SUBJECT, land: null })?.confidence,
    "low",
  );
  assert.equal(
    new PriceModel(data).score({ ...SUBJECT, kind: "other" })?.confidence,
    "low",
  );
});
