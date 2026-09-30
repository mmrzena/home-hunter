/**
 * Target areas: Praha, Středočeský kraj, and okres Jičín (Královéhradecký).
 * Sreality filters by its internal locality ids, one search per entry: a kraj
 * by `locality_region_id`, an okres by `locality_district_id`. The
 * bbox is a coarse WGS84 safety net to drop anything clearly outside these areas
 * if a filter ever drifts.
 *
 * The ids are undocumented (verified live 2026-09). If results look wrong,
 * check sreality.cz's network calls.
 */
export const SREALITY_LOCALITIES = [
  { param: "locality_region_id", id: 10, label: "Praha" },
  { param: "locality_region_id", id: 11, label: "Středočeský kraj" },
  { param: "locality_district_id", id: 30, label: "okres Jičín" },
] as const satisfies readonly {
  param: "locality_region_id" | "locality_district_id";
  id: number;
  label: string;
}[];

/** Coarse bbox covering Prague + Středočeský kraj + okres Jičín (lat/lng, WGS84). */
export const REGION_BBOX = {
  latMin: 49.4,
  latMax: 50.6,
  lngMin: 13.4,
  lngMax: 15.8,
} as const;

export function inRegionBbox(lat: number | undefined, lng: number | undefined) {
  if (lat === undefined || lng === undefined) return true; // keep; bucket by locality later
  return (
    lat >= REGION_BBOX.latMin &&
    lat <= REGION_BBOX.latMax &&
    lng >= REGION_BBOX.lngMin &&
    lng <= REGION_BBOX.lngMax
  );
}
