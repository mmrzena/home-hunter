import { type NextRequest, NextResponse } from "next/server";

import {
  getClusters,
  getClustersByIds,
  parseClusterFilters,
} from "@/lib/clusters";

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

  const clusters = await getClusters(parseClusterFilters(params));
  return NextResponse.json({ clusters });
}
