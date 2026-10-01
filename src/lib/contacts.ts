import { z } from "zod";
import type { ContactStatus, SourceName } from "@/db/schema";
import type { HouseAnalysis } from "@/lib/analysis-types";
import { formatArea, formatKind } from "@/lib/format";
import type { ClusterCard } from "@/lib/types";

/**
 * Contacted houses: the client/server contract. The house snapshot travels
 * with every save so an entry stays readable after its advert disappears.
 */
export const CONTACT_STATUSES = [
  "contacted",
  "visit_planned",
  "visited",
  "offer",
  "rejected",
] as const satisfies readonly ContactStatus[];

export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  contacted: "Contacted",
  visit_planned: "Visit planned",
  visited: "Visited",
  offer: "Offer made",
  rejected: "Not interested",
};

const SOURCES = [
  "sreality",
  "bezrealitky",
  "ceskereality",
  "realingo",
] as const satisfies readonly SourceName[];

export const CONTACT_HOUSE = z.object({
  source: z.enum(SOURCES),
  sourceId: z.string().min(1).max(64),
  url: z.url().max(2048),
  title: z.string().max(300).nullable(),
  price: z.number().int().nonnegative().nullable(),
  photo: z.url().max(2048).nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});
export type ContactHouse = z.infer<typeof CONTACT_HOUSE>;

const optionalText = (max: number) => z.string().trim().max(max);

/** What the form edits. Empty strings mean "not filled in". */
export const CONTACT_DETAILS = z.object({
  status: z.enum(CONTACT_STATUSES),
  contactName: optionalText(200),
  contactPhone: optionalText(50),
  contactEmail: z.union([z.literal(""), z.email().max(200)]),
  visitAt: z.union([z.literal(""), z.iso.datetime({ offset: true })]),
  notes: optionalText(10_000),
});
export type ContactDetails = z.infer<typeof CONTACT_DETAILS>;

export const CONTACT_SAVE = CONTACT_DETAILS.extend({ house: CONTACT_HOUSE });
export type ContactSave = z.infer<typeof CONTACT_SAVE>;

export type Contact = ContactHouse &
  ContactDetails & {
    id: number;
    createdAt: string;
    updatedAt: string;
    /** The advert as the pipeline sees it now; null when it was never crawled. */
    current: { price: number | null; isActive: boolean } | null;
  };

/**
 * `next dev` only: contacts work without sign-in, saved under one local user,
 * so the feature can be tried where Google sign-in isn't set up. Production
 * builds (Vercel included) always require a session.
 */
export const IS_DEV_WITHOUT_SIGN_IN = process.env.NODE_ENV === "development";

/** Pipeline order: what needs you soonest comes first. */
export const STATUS_ORDER: Record<ContactStatus, number> = {
  visit_planned: 0,
  offer: 1,
  visited: 2,
  contacted: 3,
  rejected: 4,
};

export function isUpcomingVisit(contact: Contact, now: number): boolean {
  return contact.visitAt !== "" && Date.parse(contact.visitAt) >= now;
}

export function isContactStatus(value: string): value is ContactStatus {
  return CONTACT_STATUSES.some((status) => status === value);
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, "")}`;
}

/** The editable details of a saved contact (what the form round-trips). */
export function detailsOf(contact: Contact): ContactDetails {
  return {
    status: contact.status,
    contactName: contact.contactName,
    contactPhone: contact.contactPhone,
    contactEmail: contact.contactEmail,
    visitAt: contact.visitAt,
    notes: contact.notes,
  };
}

export function houseFromCard(
  card: ClusterCard & { url: string },
): ContactHouse {
  return {
    source: card.source,
    sourceId: card.sourceId,
    url: card.url,
    title: [
      formatKind(card.propertyKind),
      card.usableAreaM2 != null && formatArea(card.usableAreaM2),
      card.cadastralName ?? card.localityText,
    ]
      .filter(Boolean)
      .join(" · "),
    price: card.price,
    photo: card.photo,
    lat: card.lat,
    lng: card.lng,
  };
}

export function houseFromAnalysis(
  listing: HouseAnalysis["listing"] & { url: string },
): ContactHouse {
  return {
    source: listing.source,
    sourceId: listing.sourceId,
    url: listing.url,
    title: listing.localityText ?? null,
    price: listing.price ?? null,
    photo: listing.photos?.[0] ?? null,
    lat: listing.lat ?? null,
    lng: listing.lng ?? null,
  };
}

/** The house snapshot of a saved contact, as sent back on every save. */
export function houseOf(contact: Contact): ContactHouse {
  return {
    source: contact.source,
    sourceId: contact.sourceId,
    url: contact.url,
    title: contact.title,
    price: contact.price,
    photo: contact.photo,
    lat: contact.lat,
    lng: contact.lng,
  };
}

export function contactKey(house: Pick<ContactHouse, "source" | "sourceId">) {
  return `${house.source}:${house.sourceId}`;
}
