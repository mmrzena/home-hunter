import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db, type FilterPrefs, user } from "@/db";
import { getSessionUserId } from "@/lib/session";

/**
 * Per-user filter-bar preferences — the active filter query string and which
 * filter controls are hidden — so the feed looks the same on every device.
 * Every handler is gated on the better-auth session.
 */

const MAX_QUERY_LENGTH = 2000;
const MAX_HIDDEN = 50;

function parsePrefs(body: unknown): FilterPrefs | null {
  if (typeof body !== "object" || body === null) return null;
  const { query, hidden } = body as Record<string, unknown>;
  if (typeof query !== "string" || query.length > MAX_QUERY_LENGTH) return null;
  if (
    !Array.isArray(hidden) ||
    hidden.length > MAX_HIDDEN ||
    !hidden.every((key) => typeof key === "string")
  )
    return null;
  return { query, hidden };
}

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) return NextResponse.json({ prefs: null });

  const [row] = await db
    .select({ filterPrefs: user.filterPrefs })
    .from(user)
    .where(eq(user.id, userId));

  return NextResponse.json({ prefs: row?.filterPrefs ?? null });
}

export async function PUT(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefs = parsePrefs(await request.json().catch(() => null));
  if (!prefs) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await db.update(user).set({ filterPrefs: prefs }).where(eq(user.id, userId));
  return NextResponse.json({ ok: true });
}
