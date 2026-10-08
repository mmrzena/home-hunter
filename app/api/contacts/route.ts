/**
 * Contacted houses and their notes (names, phone numbers, visit dates). Every
 * handler is gated on the better-auth session and scoped to its user: this is
 * personal data, so it never falls back to an anonymous store.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db, houseContactEvents, houseContacts, listings, user } from "@/db";
import type { HouseContactEventRow, HouseContactRow } from "@/db/schema";
import {
  CONTACT_SAVE,
  type Contact,
  type ContactCurrent,
  type ContactEvent,
  IS_DEV_WITHOUT_SIGN_IN,
} from "@/lib/contacts";
import { hubFor } from "@/lib/hubs";
import { getSessionUserId } from "@/lib/session";

const DEV_USER = {
  id: "local-dev",
  name: "Local dev",
  email: "local-dev@localhost",
  emailVerified: true,
};

type NewEvent = Pick<ContactEvent, "kind" | "detail">;

async function getUserId(request: NextRequest): Promise<string | null> {
  const userId = await getSessionUserId(request);
  if (userId || !IS_DEV_WITHOUT_SIGN_IN) return userId;
  await db.insert(user).values(DEV_USER).onConflictDoNothing();
  return DEV_USER.id;
}

function toEvent(row: HouseContactEventRow): ContactEvent {
  return {
    id: row.id,
    kind: row.kind,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCurrent(
  listing: Pick<
    typeof listings.$inferSelect,
    | "price"
    | "isActive"
    | "percentile"
    | "dealVerdict"
    | "usableAreaM2"
    | "landAreaM2"
    | "lat"
    | "lng"
  >,
): ContactCurrent {
  return {
    price: listing.price,
    isActive: listing.isActive,
    percentile: listing.percentile,
    dealVerdict: listing.dealVerdict,
    usableAreaM2: listing.usableAreaM2,
    landAreaM2: listing.landAreaM2,
    hub: hubFor(listing.lat, listing.lng),
  };
}

function toContact(
  row: HouseContactRow,
  current: ContactCurrent | null,
  events: ContactEvent[],
): Contact {
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
    rating: row.rating,
    pros: row.pros ?? "",
    cons: row.cons ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    current,
    events,
  };
}

const unauthorized = () =>
  NextResponse.json(
    { error: "Sign in to keep contact notes." },
    { status: 401 },
  );

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return unauthorized();
  const [rows, eventRows] = await Promise.all([
    db
      .select({ contact: houseContacts, listing: listings })
      .from(houseContacts)
      .leftJoin(
        listings,
        and(
          eq(listings.source, houseContacts.source),
          eq(listings.sourceId, houseContacts.sourceId),
        ),
      )
      .where(eq(houseContacts.userId, userId))
      .orderBy(desc(houseContacts.updatedAt)),
    db
      .select({ event: houseContactEvents })
      .from(houseContactEvents)
      .innerJoin(
        houseContacts,
        eq(houseContacts.id, houseContactEvents.contactId),
      )
      .where(eq(houseContacts.userId, userId))
      .orderBy(asc(houseContactEvents.createdAt), asc(houseContactEvents.id)),
  ]);
  const eventsByContact = new Map<number, ContactEvent[]>();
  for (const { event } of eventRows) {
    const list = eventsByContact.get(event.contactId) ?? [];
    list.push(toEvent(event));
    eventsByContact.set(event.contactId, list);
  }
  return NextResponse.json({
    contacts: rows.map(({ contact, listing }) =>
      toContact(
        contact,
        listing && toCurrent(listing),
        eventsByContact.get(contact.id) ?? [],
      ),
    ),
  });
}

/** What changed between the stored row and the save, as raw values the client formats. */
function changeEvents(
  previous: HouseContactRow | undefined,
  next: HouseContactRow,
): NewEvent[] {
  if (!previous) return [{ kind: "saved", detail: null }];
  const events: NewEvent[] = [];
  if (previous.status !== next.status)
    events.push({ kind: "status", detail: next.status });
  if (previous.visitAt?.getTime() !== next.visitAt?.getTime())
    events.push({ kind: "visit", detail: next.visitAt?.toISOString() ?? "" });
  if (previous.rating !== next.rating)
    events.push({ kind: "rating", detail: next.rating?.toString() ?? "" });
  return events;
}

/** Creates or updates the contact for one advert (one entry per advert). */
export async function PUT(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return unauthorized();
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
    rating: details.rating,
    pros: details.pros || null,
    cons: details.cons || null,
    updatedAt: new Date(),
  };
  // One transaction so the diff against `previous` can't race a concurrent save.
  const row = await db.transaction(async (tx) => {
    const previous = await tx.query.houseContacts.findFirst({
      where: and(
        eq(houseContacts.userId, userId),
        eq(houseContacts.source, house.source),
        eq(houseContacts.sourceId, house.sourceId),
      ),
    });
    const [saved] = await tx
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
    const events = changeEvents(previous, saved);
    if (events.length)
      await tx
        .insert(houseContactEvents)
        .values(events.map((event) => ({ contactId: saved.id, ...event })));
    return saved;
  });
  return NextResponse.json({ contact: toContact(row, null, []) });
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return unauthorized();
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id))
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await db
    .delete(houseContacts)
    .where(and(eq(houseContacts.id, id), eq(houseContacts.userId, userId)));
  return NextResponse.json({ ok: true });
}
