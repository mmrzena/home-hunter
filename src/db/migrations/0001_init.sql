-- home-hunter initial schema. Hand-written so PostGIS generated columns and
-- GiST indexes are expressed directly. Applied by worker/db/migrate.ts.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE listings (
  id                     bigserial PRIMARY KEY,
  source                 text NOT NULL,
  source_id              text NOT NULL,
  deal_type              text NOT NULL DEFAULT 'sell',
  property_kind          text,

  price                  bigint,
  currency               text NOT NULL DEFAULT 'CZK',
  rent_charges           bigint,

  usable_area_m2         integer,
  built_up_area_m2       integer,
  land_area_m2           integer,
  disposition            text,

  lat                    double precision,
  lng                    double precision,
  locality_text          text,

  cadastral_code         text,
  cadastral_name         text,
  bucket_source          text,
  size_band              text,

  seller_type            text,
  seller_name            text,
  has_ico                boolean,

  description            text,
  url                    text,
  photos                 text[] NOT NULL DEFAULT '{}',
  labels                 text[] NOT NULL DEFAULT '{}',
  posted_at              timestamptz,

  first_seen_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at           timestamptz NOT NULL DEFAULT now(),
  is_active              boolean NOT NULL DEFAULT true,

  cluster_id             bigint,

  price_per_usable_m2    integer,
  price_per_land_m2      integer,
  bucket_key             text,
  percentile             double precision,
  percentile_confidence  text,
  sample_size            integer,
  deal_verdict           text,
  is_good_deal           boolean,
  scam_score             integer,
  scam_reasons           jsonb,
  deal_reasons           jsonb,
  price_drop_pct         double precision,
  scored_at              timestamptz,

  geom geometry(Point, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,

  CONSTRAINT listings_source_source_id UNIQUE (source, source_id)
);

CREATE INDEX listings_geom_gist ON listings USING gist (geom);
CREATE INDEX listings_active_idx ON listings (is_active);
CREATE INDEX listings_cluster_idx ON listings (cluster_id);
CREATE INDEX listings_bucket_idx ON listings (bucket_key);
CREATE INDEX listings_cadastral_idx ON listings (cadastral_code);

CREATE TABLE listing_image_hashes (
  id          bigserial PRIMARY KEY,
  listing_id  bigint NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  position    integer NOT NULL,
  url         text NOT NULL,
  dhash       bigint NOT NULL,
  CONSTRAINT image_hash_listing_position UNIQUE (listing_id, position)
);

CREATE INDEX image_hashes_dhash_idx ON listing_image_hashes (dhash);
CREATE INDEX image_hashes_listing_idx ON listing_image_hashes (listing_id);

CREATE TABLE price_history (
  id          bigserial PRIMARY KEY,
  listing_id  bigint NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  price       bigint NOT NULL,
  seen_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX price_history_listing_idx ON price_history (listing_id);

-- No hard FK between listings.cluster_id and clusters (circular with the
-- representative pointer); both are app-managed during dedupe.
CREATE TABLE clusters (
  id                       bigserial PRIMARY KEY,
  representative_listing_id bigint NOT NULL,
  min_price                bigint,
  max_price                bigint,
  member_count             integer NOT NULL DEFAULT 1,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE areas (
  code    text PRIMARY KEY,
  name    text NOT NULL,
  kind    text NOT NULL,
  region  text NOT NULL,
  geom    geometry(MultiPolygon, 4326)
);

CREATE INDEX areas_geom_gist ON areas USING gist (geom);
CREATE INDEX areas_region_idx ON areas (region);
