import { haversineKm } from "@/lib/geo";

/**
 * The two towns a listing is measured against. Everything in Prague and
 * Středočeský kraj is a Prague commute; a house in okres Jičín is lived from
 * Jičín, so its "distance to town" and train times point there instead.
 * Client-safe: no station/place datasets are imported here.
 */
export type HubKey = "prague" | "jicin";

export type Hub = {
  key: HubKey;
  label: string;
  lat: number;
  lng: number;
  /** The main railway station — the destination for train times. */
  station: { name: string; lat: number; lng: number };
};

export const HUBS: Record<HubKey, Hub> = {
  prague: {
    key: "prague",
    label: "Prague",
    lat: 50.0875,
    lng: 14.4213,
    station: { name: "Praha hlavní nádraží", lat: 50.08296, lng: 14.43609 },
  },
  jicin: {
    key: "jicin",
    label: "Jičín",
    lat: 50.437,
    lng: 15.3517,
    station: { name: "Jičín", lat: 50.4305, lng: 15.36127 },
  },
};

// Okres Jičín's farthest villages (Pecka, Žlunice, Kozojedy) sit ~20–22 km from
// the town; Křinec, Rožďalovice and the Mladá Boleslav / Nymburk belt start
// beyond that and stay Prague commutes.
const JICIN_RADIUS_KM = 22;

/** Straight-line distance to the hub this location belongs to. */
export type HubDistance = { key: HubKey; label: string; km: number };

export function nearestHub(lat: number, lng: number): HubDistance {
  const jicin = HUBS.jicin;
  const toJicin = haversineKm(lat, lng, jicin.lat, jicin.lng);
  if (toJicin <= JICIN_RADIUS_KM)
    return { key: jicin.key, label: jicin.label, km: toJicin };
  const prague = HUBS.prague;
  return {
    key: prague.key,
    label: prague.label,
    km: haversineKm(lat, lng, prague.lat, prague.lng),
  };
}

/** `nearestHub` for coordinates that may be missing. */
export function hubFor(
  lat: number | null | undefined,
  lng: number | null | undefined,
): HubDistance | null {
  return lat != null && lng != null ? nearestHub(lat, lng) : null;
}
