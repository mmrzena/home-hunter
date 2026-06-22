import { type NextRequest, NextResponse } from "next/server";

import {
  type ClusterFilters,
  getClusters,
  getClustersByIds,
} from "@/lib/clusters";
import type { SortKey } from "@/lib/types";

const VERDICTS = new Set(["deal", "fair", "overpriced"]);
const SORTS = new Set([
  "newest",
  "priceAsc",
  "priceDesc",
  "bestDeal",
  "distance",
  "prague",
  "train",
]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // `?id=…&id=…` fetches those clusters by id, bypassing every filter — the
  // liked and seen collections live there regardless of the active filter bar.
  const ids = params
    .getAll("id")
    .map(Number)
    .filter((id) => Number.isFinite(id));
  if (ids.length) {
    const clusters = await getClustersByIds(ids);
    return NextResponse.json({ clusters });
  }

  const number = (key: string) => {
    const value = params.get(key);
    return value && Number.isFinite(Number(value)) ? Number(value) : undefined;
  };

  const verdict = params.get("verdict");
  const sort = params.get("sort");
  const filters: ClusterFilters = {
    maxPrice: number("maxPrice"),
    minUsable: number("minUsable"),
    maxUsable: number("maxUsable"),
    minLand: number("minLand"),
    areas: params.getAll("area").length ? params.getAll("area") : undefined,
    sources: params.getAll("source").length
      ? params.getAll("source")
      : undefined,
    verdict:
      verdict && VERDICTS.has(verdict)
        ? (verdict as ClusterFilters["verdict"])
        : undefined,
    goodDealsOnly: params.get("goodDeals") === "1",
    freshOnly: params.get("fresh") === "1",
    nearTrain: params.get("nearTrain") === "1",
    maxPragueKm: number("maxPrague"),
    kind: params.get("kind") ?? undefined,
    addedAfter: number("addedAfter"),
    sort: sort && SORTS.has(sort) ? (sort as SortKey) : "newest",
  };

  const clusters = await getClusters(filters);
  return NextResponse.json({ clusters });
}
