import { HUBS } from "@/lib/hubs";

// Free, no-key CARTO basemaps — clean Positron in light, matching Dark Matter
// in dark. Both keep colored markers legible.
export const LIGHT_MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
export const DARK_MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/** Default map centre before anything is fitted: Prague, as [lng, lat]. */
export const PRAGUE_CENTER: [number, number] = [
  HUBS.prague.lng,
  HUBS.prague.lat,
];
