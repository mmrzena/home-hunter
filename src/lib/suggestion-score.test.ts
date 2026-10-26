import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildProfile,
  type Example,
  type HouseFacts,
  scoreHouse,
} from "./suggestion-score";

const HOUSE: HouseFacts = {
  lat: 49.93,
  lng: 14.7,
  price: 9_000_000,
  usableAreaM2: 150,
  landAreaM2: 800,
  propertyKind: "rodinny_dum",
  settlementClass: "Village",
  nearestStationKm: 1,
  percentile: 40,
  placeName: "Mnichovice",
};

function liked(overrides: Partial<Example> = {}): Example {
  return { ...HOUSE, weight: 1, origin: "liked", ...overrides };
}

test("a house like the ones you liked scores near 1, a far one near 0", () => {
  const profile = buildProfile([
    liked(),
    liked({ lat: 49.94, price: 8_000_000 }),
    liked({ lng: 14.71, usableAreaM2: 170 }),
  ]);
  const twin = scoreHouse({ ...HOUSE, lat: 49.935 }, profile);
  assert.ok(twin && twin.score > 0.9, `twin scored ${twin?.score}`);
  assert.ok(twin.reasons[0].includes("near 3 houses you picked"));

  const far = scoreHouse(
    {
      ...HOUSE,
      lat: 50.5,
      lng: 15.4,
      price: 30_000_000,
      usableAreaM2: 400,
      landAreaM2: 5000,
      settlementClass: "Big city",
    },
    profile,
  );
  assert.ok(far && far.score < 0.2, `far scored ${far?.score}`);
  assert.deepEqual(far.reasons, []);
});

test("the radius cap drops a house beyond every positive example", () => {
  const profile = buildProfile([liked(), liked(), liked()]);
  const farAway = { ...HOUSE, lat: 50.5, lng: 15.4 };
  assert.equal(scoreHouse(farAway, profile, 15), null);
  assert.notEqual(scoreHouse(farAway, profile, null), null);
  assert.notEqual(scoreHouse({ ...HOUSE, lat: 49.95 }, profile, 15), null);
});

test("a rejected house nearby pulls the score down", () => {
  const base = [liked(), liked({ lat: 49.94 }), liked({ lng: 14.71 })];
  const without = scoreHouse(HOUSE, buildProfile(base));
  const withReject = scoreHouse(
    HOUSE,
    buildProfile([
      ...base,
      liked({ weight: -2, origin: "contacted", lat: 49.931, lng: 14.701 }),
    ]),
  );
  assert.ok(without && withReject && withReject.score < without.score);
});

test("missing facts are skipped, except a missing price, which is an unknown", () => {
  const profile = buildProfile([liked(), liked(), liked()]);
  const sparse = scoreHouse(
    {
      ...HOUSE,
      usableAreaM2: null,
      landAreaM2: null,
      nearestStationKm: null,
      percentile: null,
    },
    profile,
  );
  assert.ok(sparse && sparse.score > 0.9, `sparse scored ${sparse?.score}`);

  const priceOnRequest = scoreHouse({ ...HOUSE, price: null }, profile);
  const full = scoreHouse(HOUSE, profile);
  assert.ok(priceOnRequest && full && priceOnRequest.score < full.score);
  assert.ok(priceOnRequest.score > 0.7);
});
