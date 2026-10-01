import { z } from "zod";
import type { ContactStatus, SourceName } from "@/db/schema";

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

export function contactKey(house: Pick<ContactHouse, "source" | "sourceId">) {
  return `${house.source}:${house.sourceId}`;
}
