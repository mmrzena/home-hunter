/**
 * Target regions. Sreality filters by its internal `locality_region_id`
 * (Praha = 10, Středočeský kraj = 11). The bbox is a coarse WGS84 safety net to
 * drop anything clearly outside the two regions if the region filter ever drifts.
 *
 * NOTE: verify the region ids against the live API on first run — they're
 * undocumented. If results look wrong, check sreality.cz's network calls.
 */
export const SREALITY_REGION_IDS = [10, 11] as const;

/** Coarse bbox covering Prague + Středočeský kraj (lat/lng, WGS84). */
export const REGION_BBOX = {
  latMin: 49.4,
  latMax: 50.6,
  lngMin: 13.4,
  lngMax: 15.5,
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
