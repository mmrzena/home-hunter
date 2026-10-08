-- Visit outcome (a 1–5 rating with what you liked / what bothered you) and a
-- per-house activity log, so "where were we with this one" survives months of
-- searching. Events are written by the API on every meaningful change.
ALTER TABLE house_contacts
  ADD COLUMN rating smallint CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN pros text,
  ADD COLUMN cons text;

CREATE TABLE house_contact_events (
  id          bigserial PRIMARY KEY,
  contact_id  bigint NOT NULL REFERENCES house_contacts (id) ON DELETE CASCADE,
  kind        text NOT NULL,
  detail      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX house_contact_events_contact_idx
  ON house_contact_events (contact_id, created_at);

-- Existing entries get their "saved" event back-dated to when they were added.
INSERT INTO house_contact_events (contact_id, kind, created_at)
SELECT id, 'saved', created_at FROM house_contacts;
