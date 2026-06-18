import stationsData from "@/lib/stations.json";

/**
 * Railway stations + halts (vlak, not metro/tram) across Praha + Středočeský,
 * pulled once from OpenStreetMap. Used server-side in `getClusters` to tag each
 * listing with its nearest station, so the ~50 kB dataset never ships to the
 * browser. Distances are great-circle (haversine) — precise enough at these
 * ranges to answer "is it walkable to a train?".
 */
type Station = { name: string; lat: number; lng: number };

const STATIONS = stationsData as Station[];

/** Prague centre (matches the `.env.example` anchor example). */
const PRAGUE = { lat: 50.0875, lng: 14.4213 } as const;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function distanceToPragueKm(lat: number, lng: number): number {
  return haversineKm(lat, lng, PRAGUE.lat, PRAGUE.lng);
}

/** Nearest railway station to a point, or null if the dataset is empty. */
export function nearestStation(
  lat: number,
  lng: number,
): { name: string; km: number } | null {
  let best: { name: string; km: number } | null = null;
  for (const station of STATIONS) {
    const km = haversineKm(lat, lng, station.lat, station.lng);
    if (!best || km < best.km) best = { name: station.name, km };
  }
  return best;
}
