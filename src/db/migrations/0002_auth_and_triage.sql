-- Auth arrives. This app was single-user + read-only; it now signs you in with
-- Google (better-auth) and writes per-user triage. These are better-auth's core
-- tables (user/session/account/verification) plus user_triage. "user" is a
-- reserved word in Postgres, hence the quoting throughout. Applied by
-- worker/db/migrate.ts as one atomic batch.

CREATE TABLE "user" (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  email           text NOT NULL UNIQUE,
  email_verified  boolean NOT NULL DEFAULT false,
  image           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE session (
  id          text PRIMARY KEY,
  expires_at  timestamptz NOT NULL,
  token       text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  ip_address  text,
  user_agent  text,
  user_id     text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE INDEX session_user_id_idx ON session (user_id);

CREATE TABLE account (
  id                        text PRIMARY KEY,
  account_id                text NOT NULL,
  provider_id               text NOT NULL,
  user_id                   text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  access_token              text,
  refresh_token             text,
  id_token                  text,
  access_token_expires_at   timestamptz,
  refresh_token_expires_at  timestamptz,
  scope                     text,
  password                  text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_user_id_idx ON account (user_id);

CREATE TABLE verification (
  id          text PRIMARY KEY,
  identifier  text NOT NULL,
  value       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX verification_identifier_idx ON verification (identifier);

-- One triage row per (user, cluster). state is 'seen' or 'shortlist' — the two
-- are mutually exclusive intents, so a cluster has at most one row per user.
-- No FK to clusters on purpose: the pipeline rebuilds cluster ids, and a stale
-- row is harmless (it just matches no visible card), whereas an ON DELETE
-- cascade off clusters would wipe the hunt on every re-cluster.
CREATE TABLE user_triage (
  user_id     text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  cluster_id  bigint NOT NULL,
  state       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cluster_id)
);

CREATE INDEX user_triage_user_idx ON user_triage (user_id);
