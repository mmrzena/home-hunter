---
name: adding-ui-components
description: Add or use UI components in this repo the right way — pull from the shadcn/ui registry (never hand-build primitives), wire Remix icons, and respect the Server/Client component boundary. Use when building any page or feature, adding a button/dialog/table/form/etc., or reaching for an icon.
---

# Adding UI components in this starter kit

This repo already vendors **56 shadcn/ui components** (new-york style) in
`src/components/ui/`, pre-themed with the ShipMonk palette. Compose from them —
do not hand-write buttons, dialogs, inputs, tables, etc.

## Workflow

1. **Need a primitive that already exists?** Import it from `@/components/ui/<name>`.
   Check `src/components/ui/` first — it's likely there.

2. **Need one that's missing?** Add it via the registry, don't build it:
   ```bash
   nvm use 24 && npm run ui:add <name>
   ```
   This uses `components.json` (rsc: true, iconLibrary: remixicon).

3. **Verify after adding:**
   ```bash
   nvm use 24 && npm run typecheck
   grep -L "use client" src/components/ui/<name>.tsx   # should print nothing if interactive
   ```

## Icons — Remix Icon, NOT lucide

Icons come from `@remixicon/react`. Names are `Ri<PascalCase>Line`
(`RiCheckLine`, `RiArrowDownSLine`, `RiSearchLine`). Look up names at
https://remixicon.com.

shadcn's older registry components hard-code lucide imports — `ui:add`'s
transform only covers its newer `IconPlaceholder` primitive. After adding a
component, if it still imports from `lucide-react`, swap the imports by hand to
the equivalent Remix `Ri…Line` name.

## Server vs Client components — the boundary

Pages and layouts are **Server Components by default**. Add `"use client"` only
to the leaf that actually needs the browser, then compose it into the server
page. Don't mark a whole page `"use client"` because one widget needs it.

- **Stays server:** static markup, mapping over data, anything fetched/derived
  on the server. Example: `app/page.tsx` (the landing page maps a `features`
  array).
- **Needs `"use client"`:** `useState`/`useEffect`/`useReducer`, event handlers,
  Radix-driven interactive components, browser APIs, and recharts.

Pattern for an interactive island — extract it into the route's private
`_components/` folder and import it from the (server) page. For a worked
example of such an island, see the `OrdersChart` client component in
`stories/examples/DashboardOverview.stories.tsx`.

## Where a component lives — route-private vs shared

- **Used by one route → `app/<route>/_components/`.** The `_` prefix is a
  Next.js *private folder*: it's excluded from routing, so the file can never
  become a URL segment. This is the home for page-specific pieces (an extracted
  chart, a route's form dialog, a table that owns its filter state).
- **Reused by 2+ routes → `src/components/`.** This repo already splits it into
  `src/components/ui/` (shadcn primitives), `src/components/layout/` (shared
  shells), and `src/components/data-table/` (a TanStack-based filter toolkit —
  reach for it before hand-rolling a filterable table; see the
  `vibekit-design-system` skill). Promote a component here the moment a second
  route needs it.

Rule of thumb: start in the route's `_components/`; move to `src/components/`
on the second consumer. Don't import one route's `_components/` from another
route — that import is the signal to promote it.

## Layout components are router-agnostic

`Header`, `Footer`, `MainLayout`, `DashboardLayout`, `PageHeader` in
`src/components/layout/` take props for nav/brand/actions and do **not** import
`next/navigation`. Keep them that way — pass `next/link` and active state in via
props. Only App Router `layout.tsx`/`page.tsx` files may use `usePathname()` etc.

- Marketing/landing pages → wrap in `MainLayout`.
- Dashboard / app-shell routes → you add them: wrap the route segment in
  `DashboardLayout` via its `layout.tsx` (see the design-system **Dashboard
  layout wiring** recipe); pages under it are just content + a `<PageHeader>`.

## Browsable in Storybook (optional)

Add a `stories/<PascalCase>.stories.tsx` (CSF3, `@/` alias imports) if you want
the component in Storybook dev (`npm run storybook`).
