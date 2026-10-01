import { haversineKm } from "@/lib/geo";
import stationsData from "@/lib/stations.json";

/**
 * Railway stations + halts (vlak, not metro/tram) across Praha + Středočeský
 * + okres Jičín (the `REGION_BBOX` box),
 * pulled once from OpenStreetMap. Used server-side in `getClusters` to tag each
 * listing with its nearest station, so the ~50 kB dataset never ships to the
 * browser. Distances are great-circle (haversine) — precise enough at these
 * ranges to answer "is it walkable to a train?".
 */
type Station = { name: string; lat: number; lng: number };

const STATIONS = stationsData as Station[];

export type NearbyStation = Station & { km: number };

/**
 * The `count` closest railway stations to a point, nearest first. OSM maps some
 * stations as several nodes a few metres apart, so a name is kept only once.
 * Runs per feed card, hence a single bounded scan instead of a full sort.
 */
export function nearestStations(
  lat: number,
  lng: number,
  count: number,
): NearbyStation[] {
  const nearest: NearbyStation[] = [];
  for (const station of STATIONS) {
    const km = haversineKm(lat, lng, station.lat, station.lng);
    if (nearest.length === count && km >= nearest[count - 1].km) continue;
    const sameName = nearest.findIndex((kept) => kept.name === station.name);
    if (sameName !== -1) {
      if (km >= nearest[sameName].km) continue;
      nearest.splice(sameName, 1);
    }
    const at = nearest.findIndex((kept) => km < kept.km);
    nearest.splice(at === -1 ? nearest.length : at, 0, { ...station, km });
    if (nearest.length > count) nearest.pop();
  }
  return nearest;
}

/** Nearest railway station to a point, or null if the dataset is empty. */
export function nearestStation(lat: number, lng: number): NearbyStation | null {
  return nearestStations(lat, lng, 1)[0] ?? null;
}
