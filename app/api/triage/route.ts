import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db, userTriage } from "@/db";
import type { TriageState } from "@/db/schema";
import { auth } from "@/lib/auth";

/**
 * Per-user triage store — the durable, cross-device home for what used to live
 * in localStorage. Every handler is gated on the better-auth session, so a
 * signed-out (or disallowed) caller can never read or write someone's hunt.
 */

async function getUserId(request: NextRequest): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
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
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const record = asRecord(await request.json().catch(() => null));
  const clusterId = Number(record.clusterId);
  const state: TriageState | null =
    record.state === "shortlist"
      ? "shortlist"
      : record.state === "seen"
        ? "seen"
        : null;
  if (!Number.isFinite(clusterId) || state === null) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // One row per (user, cluster): seen and shortlist are mutually exclusive, so
  // an upsert flips the state in place rather than accumulating rows.
  await db
    .insert(userTriage)
    .values({ userId, clusterId, state })
    .onConflictDoUpdate({
      target: [userTriage.userId, userTriage.clusterId],
      set: { state },
    });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId(request);
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

  const clusterId = Number(params.get("clusterId"));
  if (!Number.isFinite(clusterId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  await db
    .delete(userTriage)
    .where(
      and(eq(userTriage.userId, userId), eq(userTriage.clusterId, clusterId)),
    );
  return NextResponse.json({ ok: true });
}
