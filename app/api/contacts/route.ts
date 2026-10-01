import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db, houseContacts, listings, user } from "@/db";
import type { HouseContactRow } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  CONTACT_SAVE,
  type Contact,
  IS_DEV_WITHOUT_SIGN_IN,
} from "@/lib/contacts";

const DEV_USER = {
  id: "local-dev",
  name: "Local dev",
  email: "local-dev@localhost",
  emailVerified: true,
};

/**
 * Contacted houses and their notes (names, phone numbers, visit dates). Every
 * handler is gated on the better-auth session and scoped to its user: this is
 * personal data, so it never falls back to an anonymous store.
 */

async function getUserId(request: NextRequest): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session) return session.user.id;
  if (!IS_DEV_WITHOUT_SIGN_IN) return null;
  await db.insert(user).values(DEV_USER).onConflictDoNothing();
  return DEV_USER.id;
}

function toContact(row: HouseContactRow, current: Contact["current"]): Contact {
  return {
    id: row.id,
    source: row.source,
    sourceId: row.sourceId,
    url: row.url,
    title: row.title,
    price: row.price,
    photo: row.photo,
    lat: row.lat,
    lng: row.lng,
    status: row.status,
    contactName: row.contactName ?? "",
    contactPhone: row.contactPhone ?? "",
    contactEmail: row.contactEmail ?? "",
    visitAt: row.visitAt?.toISOString() ?? "",
    notes: row.notes ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    current,
  };
}

const UNAUTHORIZED = () =>
  NextResponse.json(
    { error: "Sign in to keep contact notes." },
    { status: 401 },
  );

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return UNAUTHORIZED();
  const rows = await db
    .select({
      contact: houseContacts,
      price: listings.price,
      isActive: listings.isActive,
    })
    .from(houseContacts)
    .leftJoin(
      listings,
      and(
        eq(listings.source, houseContacts.source),
        eq(listings.sourceId, houseContacts.sourceId),
      ),
    )
    .where(eq(houseContacts.userId, userId))
    .orderBy(desc(houseContacts.updatedAt));
  return NextResponse.json({
    contacts: rows.map(({ contact, price, isActive }) =>
      toContact(
        contact,
        isActive === null ? null : { price: price ?? null, isActive },
      ),
    ),
  });
}

/** Creates or updates the contact for one advert (one entry per advert). */
export async function PUT(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return UNAUTHORIZED();
  const parsed = CONTACT_SAVE.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Bad request" },
      { status: 400 },
    );
  const { house, ...details } = parsed.data;
  const values = {
    ...house,
    status: details.status,
    contactName: details.contactName || null,
    contactPhone: details.contactPhone || null,
    contactEmail: details.contactEmail || null,
    visitAt: details.visitAt ? new Date(details.visitAt) : null,
    notes: details.notes || null,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(houseContacts)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: [
        houseContacts.userId,
        houseContacts.source,
        houseContacts.sourceId,
      ],
      set: values,
    })
    .returning();
  return NextResponse.json({ contact: toContact(row, null) });
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return UNAUTHORIZED();
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id))
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await db
    .delete(houseContacts)
    .where(and(eq(houseContacts.id, id), eq(houseContacts.userId, userId)));
  return NextResponse.json({ ok: true });
}
