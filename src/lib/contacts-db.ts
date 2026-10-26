import { and, desc, eq } from "drizzle-orm";

import { db, houseContacts, listings } from "@/db";

export function selectContactsWithListings(userId: string) {
  return db
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
    .orderBy(desc(houseContacts.updatedAt));
}
