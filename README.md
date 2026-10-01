# home-hunter

A personal tool to find a **house to buy** in **Prague + Středočeský kraj +
okres Jičín**.
It ingests listings from Czech property portals, **dedupes** the same house
listed by multiple agents, and **scores** each one on price (deal ↔ overpriced),
trust (scam signals), and distance to a place you care about — then shows the
result as a map + feed on one screen.

Stack: Next.js 16 (App Router) + shadcn/ui + Tailwind v4, a Node/TS worker, and
Postgres 16 + PostGIS.

## What it does

1. **Ingest** — pages the Sreality public JSON API for family houses + villas
   for sale (`category_main_cb=2`, `category_type_cb=1`) across Prague,
   Středočeský kraj and okres Jičín (`worker/lib/regions.ts`). Polite: a real User-Agent, a request delay, backoff, and
   detail fetched only for new/changed listings. Two more sources run by default:
   Bezrealitky (the no-commission portal, via its GraphQL API) and České reality
   (scraped); disable either with `ENABLE_BEZREALITKY=false` /
   `ENABLE_CESKEREALITY=false`. The same house listed on several portals is
   deduped into one card.
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
6. **Score** — compare recent active asking prices per usable m² for similar
   houses in the same locality, widening to 5 / 15 / 30 km when needed. Match
   property type, usable area (0.67–1.5×) and plot size (0.25–4× when known).
   Exclude the subject and its known duplicates; count each cluster once.
   Require 8 independent houses, with no country-wide fallback.
   **Land-adjusted:** when a house's plot size and local land price are known,
   houses are compared on the house alone,
   `(asking price − plot m² × local land Kč/m²) ÷ usable m²`, so a big plot
   doesn't make a fair house look overpriced. The local land price is the median
   asking Kč/m² of building plots for sale (Sreality "stavební" + Bezrealitky
   `STAVEBNI`, table `land_listings`) of a similar size (0.5–2× the plot), from
   the nearest 3 / 7 / 15 / 30 km ring with at least 6. Without a plot size or
   land price, houses are compared on asking price per usable m². Asking
   prices under 100 000 Kč ("1 Kč" placeholders) count as unknown. This gives:
   - **Good deal** = low percentile ∧ not suspicious (price drops strengthen it)
   - **Overpriced** = high percentile
   - **Caution** = weighted scam flags with reasons (stolen photos via far-geo
     photo reuse, Czech red-phrase wording, private/no-IČO, brand-new), gated by
     cheapness — every flag carries a human-readable reason.

## House analysis (`/analyse`)

Paste a **house-for-sale detail URL** from Sreality, Bezrealitky, České reality or Realingo.
The app fetches that listing on demand and shows its gallery, property details,
asking-price comparison, all comparable listings, location, seller, description,
and any existing price history or cross-portal matches. The original feed stays
at `/`, with navigation between the two pages.

- **Getting to Prague:** a map of the house and its 3 nearest railway stations,
  each with the fastest weekday-morning train (06:00–09:00) to Praha hl.n.,
  its changes and lines. Times come from the free [Transitous](https://transitous.org)
  router, fetched on demand; if it's unreachable the report just shows no train.
- Uses the same price model as the scoring worker. The displayed range is the
  middle 50% of comparable asking prices per m², scaled to the subject's usable
  area; it is **not** a sale-price appraisal or a prediction interval.
- Comparisons use active CZK sale adverts seen in the last **90 days**. Refresh
  an old local database with `npm run pipeline` before expecting comparisons.
  Confidence reflects sample depth, geographic scope, plot-data completeness
  and price dispersion. Condition and renovation costs are not adjusted for.
- Missing data or insufficient local evidence is shown explicitly. A database
  outage still allows the extracted listing to be shown, without a valuation.
- Realingo support is for pasted links. Its original-advert URL is used to
  look up existing history and exclude known duplicates from comparisons;
  external links are not crawled automatically. Locked or removed listings
  cannot be imported. Realingo is not added to the background ingestion job.
- Imports are read-only: they do not add listings to tracking or run photo
  deduplication. Existing trust signals show their last scoring date.
- URL validation allows only supported portal detail pages; redirects stay on
  the same portal and listing. Downloads have a 20-second timeout and a 5 MB cap.
- Run `npm test` for price-model and importer regression checks.

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
  runnable stage-by-stage via the CLI, or as checkpointed batches
  (`worker/durable/`) driven by the CLI, the node-cron daemon, or a Vercel
  Cron → Workflow SDK run. Writes Postgres.
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
| `ENABLE_BEZREALITKY` | `true` | Bezrealitky source (GraphQL); `false` to disable |
| `ENABLE_CESKEREALITY` | `true` | České reality source (scraped); `false` to disable |
| `INGEST_MAX_PAGES` | `40` | page cap per region per run |
| `REQUEST_DELAY_MS` | `1200` | inter-request delay to the source API |
| `MAX_IMAGES_PER_LISTING` | `8` | images hashed per listing |
| `FEED_WINDOW_HOURS` | `48` | "new / price-changed" window |
| `CRON_SECRET` | — | bearer token for `/api/cron/pipeline` + `/api/pipeline` (32+ chars; unset = both return 401) |

## Deploying (Vercel + Neon)

The web app and the daily pipeline both run on Vercel, sharing one Neon DB.
The pipeline is a [Workflow SDK](https://useworkflow.dev) durable workflow
(`src/workflows/`) that loops one small, retry-safe batch per step
(`worker/durable/run-batch.ts`). Each batch commits its work and its checkpoint
(`pipeline_runs.state`) in one transaction, so a timeout or crash resumes from the
last committed batch. The CLI (`npm run pipeline`) drives the same batches, so
local and cloud runs resume each other's checkpoints.

1. **Database: Neon** (or Vercel Postgres, which is Neon). Create a project,
   then `CREATE EXTENSION IF NOT EXISTS postgis;` (the migrate also does this).
   Grab the **pooled** connection string (host has `-pooler`, `?sslmode=require`).
   Migrate it from your machine (again after every new migration, since Vercel
   doesn't run migrations):
   ```bash
   DATABASE_URL="<neon-pooled-url>" npm run db:migrate
   DATABASE_URL="<neon-pooled-url>" npm run pipeline   # optional first data load
   ```
2. **Vercel.** Import the repo and set env `DATABASE_URL` = the Neon URL,
   `DB_POOL_MAX=1` (serverless), and `CRON_SECRET` = a random string of 32+
   characters (`openssl rand -hex 32`). Optional `ANCHOR_*`. Default `next build`.
3. **Daily run: Vercel Cron.** `vercel.json` calls `GET /api/cron/pipeline` at
   04:17 UTC (~06:17 Prague in summer). Vercel sends `Authorization: Bearer
   $CRON_SECRET`. The route creates or resumes today's `pipeline_runs` row and
   starts the workflow, unless one is already running (a single advisory lock
   plus a unique index allow only one unfinished run). Trigger it by hand the
   same way:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/pipeline
   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/pipeline  # last 10 runs + progress
   ```
4. **Fallback: GitHub Actions (manual only).** `.github/workflows/pipeline.yml`
   is no longer scheduled. Run it from Actions → "pipeline" → Run workflow
   (needs a repo secret `DATABASE_URL`). It migrates, then resumes the same
   checkpoints as the cron.

Crawl safety: a source's unseen listings are only deactivated after a
complete crawl. A capped (`INGEST_MAX_PAGES`) or failed crawl keeps them
active and records a warning in the run's `state.warnings`.

Local dev uses docker-compose throughout; `engines.node` is `>=22` for Vercel
compatibility (local dev still uses Node 24 via `.nvmrc`).

## A note on the data

This hits an undocumented public API for single-user personal research, with a
real User-Agent, a request delay, and no re-hosting of photos (only perceptual
hashes are stored; thumbnails are hot-linked). Keep concurrency low and don't
redistribute the source's content.
