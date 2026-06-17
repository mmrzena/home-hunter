import pLimit from "p-limit";

import { db, sql } from "@/db";
import { imageHashes } from "@/db/schema";
import { env } from "@/lib/env";

import { dhash } from "../lib/dhash";
import { getImageBuffer } from "../lib/http";

export type HashSummary = { listings: number; hashes: number };

/**
 * Computes perceptual hashes for active listings that don't have any yet. Only
 * the first MAX_IMAGES_PER_LISTING images are hashed; bytes are fetched into
 * memory, hashed, and discarded — we never store or rehost the photos.
 */
export async function hashImages(): Promise<HashSummary> {
  const pending = await sql<{ id: number; photos: string[] }[]>`
    SELECT l.id, l.photos
    FROM listings l
    WHERE l.is_active
      AND array_length(l.photos, 1) > 0
      AND NOT EXISTS (
        SELECT 1 FROM listing_image_hashes h WHERE h.listing_id = l.id
      )
  `;

  const limit = pLimit(env.IMAGE_CONCURRENCY);
  const summary: HashSummary = { listings: 0, hashes: 0 };

  for (const listing of pending) {
    const urls = listing.photos.slice(0, env.MAX_IMAGES_PER_LISTING);
    const rows = await Promise.all(
      urls.map((url, position) =>
        limit(async () => {
          const buffer = await getImageBuffer(url);
          if (!buffer) return null;
          const hash = await dhash(buffer);
          if (hash === null) return null;
          return { listingId: listing.id, position, url, dhash: hash };
        }),
      ),
    );

    const valid = rows.filter(
      (row): row is NonNullable<typeof row> => row !== null,
    );
    if (valid.length > 0) {
      await db.insert(imageHashes).values(valid).onConflictDoNothing();
      summary.hashes += valid.length;
    }
    summary.listings += 1;
  }

  console.log("hash done:", summary);
  return summary;
}
