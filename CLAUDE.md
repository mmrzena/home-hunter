# CLAUDE.md

Guidance for AI agents working in this repo.

## What this is

**home-hunter** — a single-user tool to find a house to buy in Prague +
Středočeský kraj. It ingests Czech property listings, dedupes the same house
across agents (perceptual image hashing + geo), and scores each on price
percentile, scam signals, and distance. See `README.md` for the full picture.

**Two processes, one Postgres + PostGIS:**

- **`worker/`** (Node/TS, run with `tsx`) — the pipeline
  `ingest → hash → bucket → dedupe → score`. Each stage is a module under
  `worker/pipeline/`, runnable individually via `worker/cli.ts`
  (`npm run ingest|hash|bucket|dedupe|score|pipeline`) or daily via
  `worker/index.ts` (node-cron). Sources implement `worker/sources/types.ts`
  (`Source`); Sreality is live, Bezrealitky is a flagged stub.
- **app (`app/`, `src/`)** — Next.js, **read-only** over Postgres via Drizzle.
  Route handlers in `app/api/` (`clusters`, `config`); the one screen is
  `app/page.tsx` → `src/components/home/` (`home-screen`, `cluster-card`,
  `cluster-detail-sheet`, `percentile-meter`, `filter-bar`, `listing-map`).
- **DB** — Drizzle schema in `src/db/schema.ts` for typed queries; **migrations
  are hand-written SQL** in `src/db/migrations/` (PostGIS generated `geom`
  columns + GiST indexes), applied by `worker/db/migrate.ts`. `src/db/index.ts`
  is the shared postgres-js pool. The `areas` table (boundary polygons) is
  seeded by `worker/seed/areas.ts`.

## App-specific conventions (read before touching the pipeline)

- **Imports.** `@/` resolves to `src/` (shared code). **Within `worker/` use
  relative imports**, and `@/…` only for `src/` modules (`@/db`, `@/lib/env`).
- **Defensive source parsing.** Every source-API parser treats JSON as
  `unknown` and returns `undefined` rather than throwing, so a shifted or
  undocumented endpoint degrades gracefully instead of crashing the pipeline.
- **Sreality is undocumented and moved.** The live API is
  `/api/v1/estates/search` (list) + `/api/v1/estates/{id}` (detail) — the old
  `/api/cs/v2/` is gone. Region filter is `locality_region_id` (10 = Praha,
  11 = Středočeský). Detail page URLs are
  `/detail/prodej/dum/{sub}/{slug}/{hash_id}`; the `sub` must be a real keyword
  (`rodinny`/`vila`/`chata`) or it 404s (the slug can be anything — it redirects).
- **Image CDN.** `sdn.cz` hotlink-protects raw image URLs (401). Only the
  whitelisted `?fl=res,100,100,1|jpg,80` derivative resolves — and referer-free,
  so the stored URL is both hashable and hot-linkable. Stored photo URLs carry
  this transform.
- **Scoring degrades gracefully.** Missing fields just mean a flag doesn't fire;
  price `<= 0` ("cena na dotaz") is treated as unknown, not a real price.

## Core architecture decisions (deliberate — do NOT "fix" these)

- **Next.js App Router** — pages under `app/`, route segments map to URLs,
  layouts compose via `app/layout.tsx` + nested page files.
- **Tailwind v4 via PostCSS** — `postcss.config.mjs` runs `@tailwindcss/postcss`.
  `app/globals.css` imports `tailwindcss` + `theme.css` and `@source`s `../app`
  and `../src` so v4 scans both directories.
- **Theme = colors + font + animations.** `src/styles/theme.css` is the single
  styling source: (1) shadcn semantic tokens for light/`.dark`
  (`--background`, `--primary`, …), (2) Material-style color scales
  (`--color-blueGrey-500`, `--color-SM-Teal-300`, …, usable as `bg-blueGrey-900`
  / `text-SM-Teal-500`), (3) `@keyframes` + `--animate-*` tokens. It deliberately
  does NOT define spacing/font-size/borderRadius scales (would clash with shadcn).
- **No auth.** This is a single-user local tool — there is no sign-in, no
  `proxy.ts`, no auth wall. `src/lib/env.ts` validates app config
  (`DATABASE_URL`, anchor, ingest tuning) via zod at boot. If ever exposed
  publicly, add a basic-auth check in a new `proxy.ts`.
- **Client-side server data goes through TanStack Query.** `QueryProvider`
  (`src/components/query-provider.tsx`) wraps the app in `app/layout.tsx` —
  SSR-safe client creation, 60s default `staleTime`, devtools in dev only. Use
  `useQuery` in client components instead of `useEffect` + `fetch`; Server
  Components / route handlers query Postgres directly (`getClusters` in
  `src/lib/clusters.ts`).
- **Errors surface as sonner toasts + a branded error boundary.** Failed
  queries toast automatically via cache-level `onError` in `QueryProvider`;
  per-call `meta` tunes it (`errorMessage`, `skipErrorToast`). `<Toaster />`
  (`src/components/ui/sonner.tsx`) is mounted once in the root layout. Render
  failures hit `app/error.tsx`.
- **shadcn/ui components** live in `src/components/ui/` (new-york style). A
  generic `src/components/data-table/` toolkit (TanStack Table) and
  `src/components/layout/` (Header/Footer/MainLayout/DashboardLayout,
  router-agnostic, props-driven) are available but unused by the current single
  screen — reach for them if you add a tabular or multi-page surface.
- **Biome (lint + format)** in one binary (`biome.json`), covering the whole
  repo including `src/components/ui/`. A per-path `overrides` block mutes a few
  rules for `src/components/ui/**` only (a11y rules shadcn handles via Radix,
  `dangerouslySetInnerHTML` in `chart.tsx`, `useExhaustiveDependencies`). Don't
  broaden it. `npm run lint` / `npm run lint:fix`.
- **Icons: [Remix Icon](https://remixicon.com/) via `@remixicon/react`** (NOT
  lucide-react). `components.json` sets `"iconLibrary": "remixicon"`. Names are
  `Ri<PascalCase>Line` (e.g. `RiHome4Line`, `RiCloseLine`). If a freshly-added
  shadcn component still imports from `lucide-react`, swap it by hand.

## Environment / toolchain

- **Node 24 via nvm.** Prefix shell commands with `nvm use 24 &&`.
- **Never run global npm installs.** Use the npm bundled with the nvm Node.
- **`.npmrc` has `min-release-age=7`** — npm refuses packages newer than 7 days.
- Pinned via `.nvmrc` (`24`) and `engines.node >= 24`.
- **Docker** for the PostGIS container (`postgis/postgis:16-3.4`); runs under
  emulation on Apple Silicon (fine for a personal tool).

## Commands

```bash
npm run dev        # next dev — http://localhost:3000
npm run build      # next build
npm run typecheck  # tsc --noEmit
npm run lint       # biome check (lint:fix to auto-fix)
npm run ui:add <n> # add a shadcn component

npm run db:up      # start PostGIS via docker compose
npm run db:migrate # apply src/db/migrations/*.sql
npm run db:seed    # load boundary polygons (see README)
npm run pipeline   # ingest → hash → bucket → dedupe → score (once)
npm run worker     # cron daemon (daily 06:00 + on boot)
# individual stages: ingest | hash | bucket | dedupe | score
```

## Non-obvious locations

- `src/db/migrations/*.sql` — **hand-written** ordered SQL (not drizzle-kit).
  The migrate runner applies each unseen file atomically; the `geom` column is
  a generated PostGIS Point and image-hash Hamming distance is
  `bit_count((a # b)::bit(64))`.
- `src/lib/env.ts` — zod-validated config, imported at boot by both app and
  worker. Defaults target the local compose Postgres so a fresh checkout runs.
- `src/lib/listing-status.ts` — shared status/tone logic (deal/overpriced/
  caution) used by cards, the detail sheet, and the map markers so they agree.
- `src/styles/theme.css` — the single styling source (besides `app/globals.css`,
  no other stylesheets).
- `globals.d.ts` — `declare module "*.css"`, lets the theme import typecheck.

## Code style

**TypeScript**
- New code is always TypeScript — never add `.js`/`.jsx`.
- Avoid `any`; prefer `unknown`. Minimize `as`; prefer `as const` / `satisfies`.
- Don't add defensive `?.`/`!= null` guards on non-nullable values; conditionally
  render genuinely-nullable ones rather than force-unwrapping. (The source
  parsers are the deliberate exception — external JSON really is `unknown`.)

**React**
- Avoid `useEffect` — prefer event handlers and derived state. The one fair use
  here is integrating an external system (MapLibre in `listing-map.tsx`).
- Don't wrap cheap derived values in `useMemo`/`useCallback`.
- Name local handlers `handle*`; prefix boolean props with `is|has|should`.
- **One component per file.** Route-private components go in a route's
  `_components/`; shared ones in `src/components/`.

**Naming & files**
- Single-char variable names only for `_`, `i`, `j`. Prefer `listing` over `l`.
- Files are kebab-case (lint-enforced via `useFilenamingConvention`).
- Module constants are `SCREAMING_SNAKE_CASE`.
- Components use **named** exports; Next.js `page.tsx`/`layout.tsx` stay default.
- Imports use `@/` (src) — never deep relative within `src/`; relative within
  `worker/`.

**Styling**
- Tailwind only; never inline `style={{}}` except genuinely dynamic values
  (e.g. a marker's `left: ${pct}%`, a runtime color via CSS variable).
- Never `transition-all` — animate specific properties.

**Comments** — only when code is genuinely hard to follow; never narrate changes.

Lint-enforced by Biome: no `any` (`noExplicitAny`), no force-unwrap
(`noNonNullAssertion`, warn), kebab-case filenames. The rest are reviewed, not
linted.

## Agent skills

Task-specific playbooks in `.claude/skills/` (auto-loaded by description):

- **`adding-ui-components`** — pull from the shadcn registry, wire Remix icons,
  Server/Client boundary.
- **`building-charts`** — recharts wrapped in `ChartContainer`, themed via CSS
  variables.
- **`state-management`** — the state ladder (derive/server → `useState` →
  `useReducer` → TanStack Query → zustand/jotai; `react-hook-form` + `zod`).
- **`vibekit-design-system`** — picking shadcn components and composing on-theme
  layouts (inherited from the starter; the recipes still apply).

## Adding a stage or surface

- **New pipeline stage**: add a module under `worker/pipeline/`, register it in
  `worker/cli.ts` (COMMANDS) and `worker/pipeline/run.ts` (order matters —
  hashes + buckets before dedupe, dedupe + buckets before scoring). Verify with
  `npm run typecheck` and a live run against the local DB.
- **New source**: implement `Source` in `worker/sources/`, keep parsing
  defensive, and gate it behind an env flag until its live shape is confirmed
  (see `bezrealitky.ts`).
- **New page/component**: `npm run ui:add <name>` for primitives; build the page
  under `app/`. Verify with `npm run typecheck` and `npm run build`.
