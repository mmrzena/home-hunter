-- Per-user filter-bar preferences — the cross-device home for the active
-- filter query string and the set of hidden filter controls. Nullable: a user
-- who has never touched a filter has none, and the client restores nothing.
ALTER TABLE "user" ADD COLUMN filter_prefs jsonb;
