-- Building plots for sale, used only to estimate local land prices. Kept apart
-- from `listings` so plots never reach the house feed, dedupe or scoring.
CREATE TABLE land_listings (
  id            bigserial PRIMARY KEY,
  source        text NOT NULL,
  source_id     text NOT NULL,
  price         bigint,
  area_m2       integer,
  lat           double precision,
  lng           double precision,
  locality_text text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  is_active     boolean NOT NULL DEFAULT true,
  geom geometry(Point, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
  CONSTRAINT land_listings_source_source_id UNIQUE (source, source_id)
);
CREATE INDEX land_listings_geography_active_idx
  ON land_listings USING gist ((geom::geography)) WHERE is_active;

-- Local land price per m² for each house's plot, set by the pipeline's land
-- phase: median of size-matched building plots in the nearest ring with enough.
ALTER TABLE listings
  ADD COLUMN land_price_m2        integer,
  ADD COLUMN land_price_sample    integer,
  ADD COLUMN land_price_radius_km integer,
  ADD COLUMN price_basis          text;

-- Token prices ("1 Kč") are price-on-request placeholders, not prices. Ingest
-- now stores them as unknown; clear the ones already saved.
UPDATE listings SET price = NULL WHERE price > 0 AND price < 100000;
