import assert from "node:assert/strict";
import { test } from "node:test";
import { HUBS } from "@/lib/hubs";
import { fastestTrain } from "@/lib/train-times";

const HOUSE = { lat: 50.43, lng: 15.58 };

function itinerary(minutes: number, departsAt: string, lines: string[]) {
  return {
    duration: minutes * 60,
    legs: [
      { mode: "WALK", startTime: departsAt },
      ...lines.map((line) => ({
        mode: "REGIONAL_RAIL",
        routeShortName: line,
        startTime: departsAt,
      })),
    ],
  };
}

test("picks the fastest morning train and ignores walking legs", async (context) => {
  const urls: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    const time = new URL(url).searchParams.get("time") ?? "";
    return Response.json({
      itineraries: [
        itinerary(130, time, ["V50", "V41", "R10"]),
        itinerary(118, time, ["V41", "R10"]),
        // Leaves days later from a sparse halt: not a commute.
        itinerary(60, "2099-01-01T05:00:00Z", ["R10"]),
      ],
    });
  });
  const trip = await fastestTrain(HOUSE, HUBS.prague.station);
  assert.deepEqual(
    { minutes: trip?.minutes, transfers: trip?.transfers, lines: trip?.lines },
    { minutes: 118, transfers: 1, lines: ["V41", "R10"] },
  );
  const params = new URL(urls[0]).searchParams;
  assert.equal(params.get("transitModes"), "RAIL");
  assert.equal(
    params.get("toPlace"),
    `${HUBS.prague.station.lat},${HUBS.prague.station.lng}`,
  );
  const departure = new Date(params.get("time") ?? "");
  assert.ok(departure.getUTCDay() >= 1 && departure.getUTCDay() <= 5);
  const pragueTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(departure);
  assert.equal(pragueTime, "06:00");
});

test("router failures and odd shapes degrade to no train", async (context) => {
  const responses = [
    () => new Response("down", { status: 503 }),
    () => Response.json({ itineraries: [{ duration: "soon" }] }),
    () => Promise.reject(new Error("network")),
  ];
  for (const respond of responses) {
    context.mock.method(globalThis, "fetch", async () => respond());
    assert.equal(await fastestTrain(HOUSE, HUBS.prague.station), null);
  }
});
