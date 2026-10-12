import { and, asc, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db, userTriage } from "@/db";
import type { TriageState } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";

/**
 * Per-user triage store — the durable, cross-device home for what used to live
 * in localStorage. Every handler is gated on the better-auth session, so a
 * signed-out (or disallowed) caller can never read or write someone's hunt.
 */

// "Mark all seen" sends a whole feed at once; this caps a single request.
const MAX_IDS = 5000;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

async function readBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  return asRecord(await request.json().catch(() => null));
}

/** The body's `clusterIds`, or null if missing / malformed / oversized. */
function parseClusterIds(body: Record<string, unknown>): number[] | null {
  const ids = body.clusterIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS)
    return null;
  if (!ids.every((id): id is number => Number.isInteger(id))) return null;
  return ids;
}

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) return NextResponse.json({ seen: [], shortlist: [] });

  // Oldest-added first, so the client's Set keeps insertion order (newest last)
  // and the feed can present liked / seen newest-added-first.
  const rows = await db
    .select({ clusterId: userTriage.clusterId, state: userTriage.state })
    .from(userTriage)
    .where(eq(userTriage.userId, userId))
    .orderBy(asc(userTriage.createdAt));

  const seen: number[] = [];
  const shortlist: number[] = [];
  for (const row of rows) {
    (row.state === "shortlist" ? shortlist : seen).push(row.clusterId);
  }
  return NextResponse.json({ seen, shortlist });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readBody(request);
  const state: TriageState | null =
    body.state === "shortlist"
      ? "shortlist"
      : body.state === "seen"
        ? "seen"
        : null;
  const clusterIds = parseClusterIds(body);
  if (!clusterIds || state === null) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // One row per (user, cluster): seen and shortlist are mutually exclusive, so
  // an upsert flips the state in place rather than accumulating rows.
  await db
    .insert(userTriage)
    .values(clusterIds.map((clusterId) => ({ userId, clusterId, state })))
    .onConflictDoUpdate({
      target: [userTriage.userId, userTriage.clusterId],
      set: { state },
    });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  // ?state=seen clears every "seen" row at once (the "Restore all" action).
  const stateParam = params.get("state");
  if (stateParam === "seen" || stateParam === "shortlist") {
    await db
      .delete(userTriage)
      .where(
        and(eq(userTriage.userId, userId), eq(userTriage.state, stateParam)),
      );
    return NextResponse.json({ ok: true });
  }

  const clusterIds = parseClusterIds(await readBody(request));
  if (!clusterIds) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  await db
    .delete(userTriage)
    .where(
      and(
        eq(userTriage.userId, userId),
        inArray(userTriage.clusterId, clusterIds),
      ),
    );
  return NextResponse.json({ ok: true });
}
