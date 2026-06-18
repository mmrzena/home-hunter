import placesData from "@/lib/places.json";
import { haversineKm } from "@/lib/stations";

/**
 * Settlements (city/town/village/hamlet) with population, pulled once from
 * OpenStreetMap. Used server-side in `getClusters` to tag each listing with how
 * big a place it sits in — a one-village hamlet reads very differently from a
 * town. Matched by nearest settlement centre (haversine), with Prague handled
 * by name since its listings sit far from the single city node.
 */
type Place = {
  name: string;
  lat: number;
  lng: number;
  pop: number | null;
  type: string;
};

const PLACES = placesData as Place[];

// Prague's listings (e.g. "Praha 5 – Stodůlky") sit far from the lone city node,
// so resolve them by name rather than nearest-centre. Pop ≈ ČSÚ figure.
const PRAGUE_POPULATION = 1_357_000;

export type SettlementClass =
  | "Hamlet"
  | "Village"
  | "Town"
  | "City"
  | "Big city";

function classify(population: number | null, type: string): SettlementClass {
  if (population != null) {
    if (population < 500) return "Hamlet";
    if (population < 2000) return "Village";
    if (population < 25_000) return "Town";
    if (population < 100_000) return "City";
    return "Big city";
  }
  if (type === "city") return "Big city";
  if (type === "town") return "Town";
  if (type === "hamlet") return "Hamlet";
  return "Village";
}

/** Population + size class for a listing's settlement (null when unknown). */
export function placeInfo(
  lat: number | null,
  lng: number | null,
  localityName: string | null,
): { population: number | null; settlementClass: SettlementClass | null } {
  // "Praha" in the name means the capital — EXCEPT "Praha-východ"/"Praha-západ",
  // which are Středočeský districts (okresy) full of small villages. Those fall
  // through to the nearest-settlement lookup for their real population.
  const name = localityName ?? "";
  const isOkres = /praha[\s-]*(v[ýy]chod|z[áa]pad)/i.test(name);
  if (!isOkres && /praha/i.test(name)) {
    return { population: PRAGUE_POPULATION, settlementClass: "Big city" };
  }
  if (lat == null || lng == null) {
    return { population: null, settlementClass: null };
  }
  let best: Place | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const place of PLACES) {
    const km = haversineKm(lat, lng, place.lat, place.lng);
    if (km < bestKm) {
      bestKm = km;
      best = place;
    }
  }
  if (!best) return { population: null, settlementClass: null };
  return {
    population: best.pop,
    settlementClass: classify(best.pop, best.type),
  };
}
