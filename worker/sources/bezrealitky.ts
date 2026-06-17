import type { RawListing, Source } from "./types";

/**
 * Bezrealitky uses a GraphQL `advertList` endpoint with a different shape. It's
 * deferred behind ENABLE_BEZREALITKY until its live schema is confirmed — the
 * Source interface is the contract a real implementation fills in. Until then
 * this yields nothing so Sreality is a complete working slice on its own.
 */
export function createBezrealitkySource(): Source {
  return {
    name: "bezrealitky",
    async *listPages(): AsyncGenerator<RawListing> {
      // TODO: POST the advertList GraphQL query for Praha + Středočeský houses,
      // map nodes -> RawListing. See worker/sources/sreality.ts for the shape.
    },
    async enrich(): Promise<Partial<RawListing>> {
      return {};
    },
    completed: () => true,
  };
}
