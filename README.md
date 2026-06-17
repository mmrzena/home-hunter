# home-hunter

A personal tool to find a **house to buy** in **Prague + Středočeský kraj**.
It ingests listings from Czech property portals, **dedupes** the same house
listed by multiple agents, and **scores** each one on price (deal ↔ overpriced),
trust (scam signals), and distance to a place you care about — then shows the
result as a map + feed on one screen.

Stack: Next.js 16 (App Router) + shadcn/ui + Tailwind v4, a Node/TS worker, and
Postgres 16 + PostGIS.

## What it does

1. **Ingest** — pages the Sreality public JSON API for family houses + villas
   for sale (`category_main_cb=2`, `category_type_cb=1`) across Prague +
   Středočeský kraj. Polite: a real User-Agent, a request delay, backoff, and
   detail fetched only for new/changed listings. Bezrealitky is stubbed behind a
   flag (`ENABLE_BEZREALITKY`).
2. **Normalize** — maps each source into one schema (price, areas, disposition,
   GPS, seller, photos, labels …).
3. **Hash** — computes a 64-bit perceptual hash (dHash) per image **in memory**;
   only the hash is stored as `bigint`. Photos are never re-hosted.
4. **Bucket** — resolves each listing's GPS to a canonical area via PostGIS
   point-in-polygon against seeded boundaries, falling back to the source's
   locality string. Assigns a usable-area size band.
5. **Dedupe** — clusters the same property (geo ≤ 50 m ∧ usable area ±10% ∧ same
   deal type ∧ ≥1 shared photo, Hamming ≤ 10) via union-find. A card shows the
   lowest price + every place it's listed.
6. **Score** — a robust per-bucket CZK/m² distribution (median / p25 / p75 over
   `area × size-band`, widened when thin) gives each listing a percentile, and:
   - **Good deal** = low percentile ∧ not suspicious (price drops strengthen it)
   - **Overpriced** = high percentile
   - **Caution** = weighted scam flags with reasons (stolen photos via far-geo
     photo reuse, Czech red-phrase wording, private/no-IČO, brand-new), gated by
     cheapness — every flag carries a human-readable reason.

## The screen (`/`)

One screen: a **MapLibre map** (OpenFreeMap tiles, no key) beside a **feed** of
deduped cluster cards, kept in sync.

- **Filter bar** (URL-persisted, shareable): sort, max price, min usable m²,
  min land m², area multi-select, "good deals", and "new in last N h".
- **Cards** carry a status badge (good deal / overpriced / caution), a
  price-percentile meter (green→amber with a marker), price + spread across
  sources, area/land, locality, anchor distance, top reasons, and a Sreality link.
- **Map markers** are colored by status (with a legend); a **header summary**
  shows counts (deals / new / caution) and a refresh button.
- **Interaction**: clicking a **marker** opens a popup peek (and scrolls the
  feed to it); clicking a **card** opens the **detail sheet** — a photo gallery,
  full facts grid, every deal/scam reason, and **all "listed at" sources** with
  prices and links.

## Architecture

Two processes, one Postgres:

- **`worker/`** — Node/TS pipeline (`ingest → hash → bucket → dedupe → score`),
  runnable stage-by-stage via the CLI or daily via cron. Writes Postgres.
- **app (`app/`, `src/`)** — Next.js, **read-only** over Postgres through
  Drizzle. The heavy/fragile scraping never touches the request path. Read API:
  `app/api/clusters` + `app/api/config`; the screen is `app/page.tsx` →
  `src/components/home/` (`home-screen`, `cluster-card`, `cluster-detail-sheet`,
  `percentile-meter`, `filter-bar`, `listing-map`), fed via TanStack Query.
- **Postgres 16 + PostGIS** — the spine. `ST_DWithin` for proximity dedupe,
  `ST_Contains` for the cadastral join, `percentile`-style stats, and
  `bit_count((a # b)::bit(64))` for image-hash Hamming distance.

Migrations are hand-written SQL (`src/db/migrations/`) so PostGIS generated
columns + GiST indexes are expressed directly; Drizzle is used for typed queries.

## Quick start

Requires **Node 24** (`nvm use 24`) and **Docker**.

```bash
npm install
npm run db:up                 # start PostGIS (docker compose)
npm run db:migrate            # apply schema
npm run db:seed               # optional: load boundary polygons (see below)
npm run pipeline              # ingest → hash → bucket → dedupe → score (once)
npm run dev                   # web app at http://localhost:3000
```

Run pipeline stages individually: `npm run ingest`, `npm run hash`,
`npm run bucket`, `npm run dedupe`, `npm run score`.

Run the worker as a daemon (daily ingest at 06:00 + on boot): `npm run worker`.

Full containerized run (web + worker too): `docker compose --profile full up -d --build`.

## Boundary seeding (the bucketing "clever bit")

Meaningful price buckets need real area boundaries. The seed loads GeoJSON
FeatureCollections into the `areas` table:

```bash
SEED_PRAHA_GEOJSON=./data/praha-ku.geojson \
SEED_STREDOCESKY_GEOJSON=./data/stredocesky-obce.geojson \
SEED_SRID=4326 \
npm run db:seed
```

- **Prague**: katastrální území from the [IPR Praha geoportal](https://www.geoportalpraha.cz/) (open data).
- **Středočeský**: obce from ČÚZK / RÚIAN.

Export them as **WGS84 (EPSG:4326)** GeoJSON, or pass `SEED_SRID=5514` for
S-JTSK exports (they get transformed). **Without boundaries the app still
runs** — bucketing falls back to the source locality string, and percentiles
are labeled "low confidence".

## Configuration (`.env.local`)

| Var | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | local compose | Postgres + PostGIS connection (override for Neon) |
| `DB_POOL_MAX` | `10` | connection-pool size (set `1` on Vercel serverless) |
| `ANCHOR_LAT` / `ANCHOR_LNG` / `ANCHOR_LABEL` | — | optional anchor for commute distance + bearing |
| `ENABLE_BEZREALITKY` | `false` | turn on the (stubbed) second source |
| `INGEST_MAX_PAGES` | `40` | page cap per region per run |
| `REQUEST_DELAY_MS` | `1200` | inter-request delay to the source API |
| `MAX_IMAGES_PER_LISTING` | `8` | images hashed per listing |
| `FEED_WINDOW_HOURS` | `48` | "new / price-changed" window |

## Deploying (hybrid: Vercel + Neon + GitHub Actions)

The web app can run on Vercel, but the ingest worker can't (long jobs + `sharp`),
so it runs as a scheduled GitHub Actions job. All three share one cloud DB.

1. **Database — Neon** (or Vercel Postgres, which is Neon). Create a project,
   then `CREATE EXTENSION IF NOT EXISTS postgis;` (the migrate also does this).
   Grab the **pooled** connection string (host has `-pooler`, `?sslmode=require`).
   Seed it from your machine:
   ```bash
   DATABASE_URL="<neon-pooled-url>" npm run db:migrate
   DATABASE_URL="<neon-pooled-url>" npm run pipeline   # first data load
   ```
2. **Web — Vercel.** Import the repo, set env `DATABASE_URL` = the Neon URL and
   `DB_POOL_MAX=1` (serverless). Optional `ANCHOR_*`. Default `next build`. Tiles
   + thumbnails are key-free, so nothing else to configure.
3. **Worker — GitHub Actions.** Add a repo secret `DATABASE_URL` (the Neon URL);
   `.github/workflows/pipeline.yml` runs `db:migrate` + `pipeline` nightly and
   on-demand (Actions → "pipeline" → Run workflow).

Local dev uses docker-compose throughout; `engines.node` is `>=22` for Vercel
compatibility (local dev still uses Node 24 via `.nvmrc`).

## A note on the data

This hits an undocumented public API for single-user personal research, with a
real User-Agent, a request delay, and no re-hosting of photos (only perceptual
hashes are stored; thumbnails are hot-linked). Keep concurrency low and don't
redistribute the source's content.
