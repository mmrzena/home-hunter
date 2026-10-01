-- The "new since last visit" feed mark is gone from the app; drop its column.
ALTER TABLE "user" DROP COLUMN IF EXISTS feed_seen_at;
