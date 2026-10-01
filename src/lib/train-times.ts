/**
 * Train journey times to a hub station (Praha hl.n. or Jičín) via Transitous
 * (https://transitous.org), a free MOTIS router over the Czech national
 * timetables. Called on demand from the house analysis only. Every failure
 * (timeout, shape change, no connection) yields null so the report still renders.
 */
const PLAN_URL = "https://api.transitous.org/api/v5/plan";
const DEPARTURE_HOUR = 6; // Prague local; the router searches ~2 h onward.
// A sparse halt makes the router look days ahead; that is not a commute.
const MAX_WAIT_MS = 3 * 60 * 60 * 1000;
const USER_AGENT = "home-hunter/0.1 (personal research)";

export type TrainTrip = {
  minutes: number;
  transfers: number;
  /** ISO time the first train leaves. */
  departsAt: string;
  /** Line names in ride order, e.g. ["S9"] or ["V50", "R10"]. */
  lines: string[];
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** `hour`:00 Prague time on the next weekday, as a UTC ISO string. */
function nextWeekdayMorning(hour: number): string {
  const date = new Date();
  do date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  const day = date.toISOString().slice(0, 10);
  const guess = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
  const pragueHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Prague",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(guess),
  );
  guess.setUTCHours(guess.getUTCHours() - (pragueHour - hour));
  return guess.toISOString();
}

function parseTrip(value: unknown): TrainTrip | undefined {
  const itinerary = asRecord(value);
  if (typeof itinerary?.duration !== "number" || !Array.isArray(itinerary.legs))
    return undefined;
  const rides = itinerary.legs
    .map(asRecord)
    .filter(
      (leg): leg is Record<string, unknown> =>
        leg !== undefined && leg.mode !== "WALK",
    );
  const departsAt = rides[0]?.startTime;
  if (rides.length === 0 || typeof departsAt !== "string") return undefined;
  return {
    minutes: Math.round(itinerary.duration / 60),
    transfers: rides.length - 1,
    departsAt,
    lines: rides
      .map((leg) => leg.routeShortName ?? leg.displayName)
      .filter((line): line is string => typeof line === "string"),
  };
}

/** Fastest weekday-morning rail trip from a station to a hub station, or null. */
export async function fastestTrain(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<TrainTrip | null> {
  const time = nextWeekdayMorning(DEPARTURE_HOUR);
  const latest = Date.parse(time) + MAX_WAIT_MS;
  const params = new URLSearchParams({
    fromPlace: `${from.lat},${from.lng}`,
    toPlace: `${to.lat},${to.lng}`,
    time,
    transitModes: "RAIL",
    numItineraries: "5",
    maxItineraries: "5",
  });
  try {
    const response = await fetch(`${PLAN_URL}?${params}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      // The query only changes once a day (coordinates + next weekday).
      next: { revalidate: 12 * 60 * 60 },
    });
    if (!response.ok) return null;
    const body = asRecord(await response.json());
    const trips = (Array.isArray(body?.itineraries) ? body.itineraries : [])
      .map(parseTrip)
      .filter(
        (trip): trip is TrainTrip =>
          trip !== undefined && Date.parse(trip.departsAt) <= latest,
      );
    if (trips.length === 0) return null;
    return trips.reduce((best, trip) =>
      trip.minutes < best.minutes ? trip : best,
    );
  } catch {
    return null;
  }
}
