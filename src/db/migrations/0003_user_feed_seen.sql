-- Per-user "feed caught up through" high-water mark — the cross-device home for
-- the localStorage feed-seen mark. A listing reads as "new" until its first-seen
-- time is no later than this. Nullable: a user who has never caught up has no
-- mark, and the client starts the clock locally on first visit.
ALTER TABLE "user" ADD COLUMN feed_seen_at timestamptz;
