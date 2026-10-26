import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseClusterFilters } from "@/lib/clusters";
import { getUserIdOrDevUser } from "@/lib/session";
import { SUGGESTION_LIMITS, SUGGESTION_RADII_KM } from "@/lib/suggestion-score";
import { getSuggestions } from "@/lib/suggestions";

const ids = z.array(z.number().int().positive());

// The liked and seen sets travel in the body: signed out they only exist in
// the browser, and signed in the client's optimistic copy is fresher than the
// server's. Contacts are read server-side from the session. Filters ride in
// the query string exactly as `/api/clusters` takes them.
const BODY = z.object({
  liked: ids.max(2000),
  hidden: ids.max(10_000),
  limit: z.literal(SUGGESTION_LIMITS).default(25),
  radiusKm: z.literal(SUGGESTION_RADII_KM).nullable().default(null),
});

export async function POST(request: NextRequest) {
  const parsed = BODY.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const result = await getSuggestions({
    userId: await getUserIdOrDevUser(request),
    likedIds: parsed.data.liked,
    hiddenIds: parsed.data.hidden,
    filters: parseClusterFilters(request.nextUrl.searchParams),
    limit: parsed.data.limit,
    radiusKm: parsed.data.radiusKm,
  });
  return NextResponse.json(result);
}
