-- Checkpoints and staging remain in Postgres, not Workflow step payloads.
CREATE TABLE pipeline_runs (
  id uuid PRIMARY KEY,
  day date UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  workflow_id text,
  state jsonb NOT NULL,
  error text
);
CREATE UNIQUE INDEX pipeline_one_active ON pipeline_runs ((true)) WHERE finished_at IS NULL;

CREATE TABLE pipeline_edges (
  run_id uuid NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  a_id bigint NOT NULL,
  b_id bigint NOT NULL,
  PRIMARY KEY (run_id, a_id, b_id)
);

CREATE INDEX listings_geography_active_idx ON listings USING gist ((geom::geography)) WHERE is_active;
