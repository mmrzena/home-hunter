import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db, user } from "@/db";
import { auth } from "@/lib/auth";

/**
 * Per-user "feed caught up through" mark — the cross-device home for what
 * otherwise lives in localStorage. Wire format is a ms-epoch number (or null),
 * matching the client store. Every handler is gated on the better-auth session,
 * so a signed-out caller can never read or write someone's mark.
 */

async function getUserId(request: NextRequest): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ seenAt: null });

  const [row] = await db
    .select({ feedSeenAt: user.feedSeenAt })
    .from(user)
    .where(eq(user.id, userId));

  return NextResponse.json({ seenAt: row?.feedSeenAt?.getTime() ?? null });
}

export async function PUT(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const seenAt =
    typeof body === "object" && body !== null
      ? Number((body as Record<string, unknown>).seenAt)
      : Number.NaN;
  if (!Number.isFinite(seenAt)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await db
    .update(user)
    .set({ feedSeenAt: new Date(seenAt) })
    .where(eq(user.id, userId));
  return NextResponse.json({ ok: true });
}
