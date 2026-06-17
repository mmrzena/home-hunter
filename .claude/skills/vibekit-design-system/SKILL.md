---
name: vibekit-design-system
description: Design and compose on-theme UI in this repo - pick the right shadcn/ui component for a need, choose a layout (MainLayout vs DashboardLayout), assemble page patterns (KPI grids, data tables, dialog/sheet forms, tabs, empty states), and apply the ShipMonk theme tokens consistently. Use when asked to "design a page", "build a screen/dashboard", "which component should I use", "lay out a page", "make the UI look good", or "improve the design".
---

# Designing UI in this starter kit

This is the **decision and composition layer**: which component to reach for, how
to lay out a page, and how to keep it on-theme. It sits on top of the other UI
skills and points to them instead of repeating them:

- **Mechanics of adding a component** (`npm run ui:add`, Remix icons, the
  Server/Client boundary, where files live) → the `adding-ui-components` skill.
- **Any chart or data-viz** → the `building-charts` skill.
- **Where state lives** (`useState`/`useReducer`/forms/stores) → the
  `state-management` skill.

Everything is already vendored: **56 shadcn/ui components** (new-york style) in
`src/components/ui/`, pre-themed; layout shells in `src/components/layout/`; the
theme in `src/styles/theme.css`. Compose from these - never hand-build primitives.

## The design workflow

Design a screen in four passes: **layout → page pattern → components → theme.**
Each pass has a reference file with the full detail.

## Step 1 - Pick a layout

| Building… | Use | Notes |
| --- | --- | --- |
| Marketing / landing page | `MainLayout` (`src/components/layout`) | Pass `header`/`footer` config objects. See `app/page.tsx`. |
| A dashboard / app-shell area | `DashboardLayout` in that route segment's `layout.tsx` | Client Component (`"use client"`; sidebar state is React context). Wire `usePathname()` for active nav; pass `navGroups`/`brand`/`topBarActions`. There's no dashboard route by default - see the **Dashboard layout wiring** recipe. Pages under it are content + `<PageHeader>`. |
| Auth / standalone card | no layout wrapper | Center a `Card` on `bg-muted/40`. See `app/sign-in/page.tsx`. |

Layout components are **router-agnostic** - pass `next/link` and active state in
via props (the why and how live in `adding-ui-components`).

Every dashboard page opens with `PageHeader` (`title`, optional `description`,
optional `actions`) - not a bare `<h1>`. It already handles spacing (`mb-6`) and
the responsive title/actions row.

## Step 2 - Pick a page pattern

Most screens are an assembly of a few recurring patterns. Reach for the matching
recipe in **`references/page-recipes.md`** (each has a copy-adaptable skeleton and
a worked example to read — a Storybook story under `Examples/*`, or the `app/`
file for the landing/auth pages):

- **KPI / stat grid** - `grid gap-4 md:grid-cols-2 lg:grid-cols-4` of `Card`s.
- **Content + sidebar split** - `grid gap-4 lg:grid-cols-3` with `lg:col-span-2`.
- **Data table** - TanStack table + the `@/components/data-table` toolkit
  (search, faceted filters, active-filter chips, reset, row selection) + status
  `Badge` + row-action `DropdownMenu` + pagination + `Empty` fallback.
- **Create/edit form** - `Dialog` (modal) or `Sheet` (side panel) + `Form`.
- **Tabbed settings** - `Tabs` with a `Card` per `TabsContent`.
- **Card grid with preview** - `HoverCard` over `Card`s.
- **Marketing hero + feature cards**, **centered auth card**, **not found / 404**.

## Step 3 - Pick the component for each need

The full annotated catalog of all 56 components is in
**`references/component-catalog.md`**. The high-frequency choices that are easy to
get wrong:

| Need | Use | Not |
| --- | --- | --- |
| Confirm a destructive action | `AlertDialog` | `Dialog` (no built-in confirm/cancel semantics) |
| Create/edit form, focused | `Dialog` + `Form` | a new page, for a few fields |
| Create/edit form, keep context | `Sheet` (side panel) | `Dialog`, when the underlying list matters |
| Transient success/error feedback | `Sonner` toast (`toast()`) | `Alert` |
| Persistent inline notice | `Alert` | a toast |
| Pick a date | `DatePicker` (`@/components/date-picker`) | a raw `Input` |
| Choose from many options (searchable) | `Combobox` / `Command` | `Select` |
| Choose from a few options | `Select` | `RadioGroup` unless all options should be visible |
| On/off setting | `Switch` | `Checkbox` (use for multi-select lists / consent) |
| Status label | `Badge` (`variant` per status) | a styled `span` |
| Row / overflow actions | `DropdownMenu` | inline buttons crowding the row |
| Loading a region | `Skeleton` | a spinner that collapses layout |
| Inline/pending action | `Spinner` | - |
| Determinate progress | `Progress` | - |
| No data / no results | `Empty` | a bare "nothing here" string |
| Hover-reveal detail | `HoverCard` | `Tooltip` (text only) |
| Click-reveal rich content | `Popover` | `HoverCard` |

When in doubt between two neighbors, the catalog's disambiguation notes
(Dialog/AlertDialog/Sheet/Drawer, Select/Combobox/native-select,
HoverCard/Tooltip/Popover, Sonner/Alert) resolve it.

## Step 4 - Apply the theme

Detail in **`references/theming.md`**. The essentials:

- **Color comes from semantic tokens**, used as Tailwind utilities:
  `bg-background`/`text-foreground`, `bg-primary text-primary-foreground`,
  `bg-card`, `bg-muted text-muted-foreground`, `border`, `text-destructive`,
  `text-success`, `bg-accent`. These flip correctly in dark mode.
- **Reach for the Material scales** (`bg-SM-Teal-500`, `text-blueGrey-600`,
  `border-blue-200`, …) only when a semantic token can't express it - e.g. a
  fixed categorical color. Default to tokens.
- **Never raw hex** in markup. **Never** dark-mode-specific colors by hand - use
  tokens so both modes work.
- Standard accent block: `inline-flex size-9 items-center justify-center
  rounded-md bg-primary/10 text-primary` (icon chip). Opacity variants
  (`bg-primary/10`, `hover:bg-accent/40`) are encouraged.

## Rules that keep designs consistent

- **Compose, don't hand-build.** If a primitive is missing, add it via the
  registry (→ `adding-ui-components`), never re-implement it.
- **Tailwind utilities only.** No inline `style={{}}` except a genuinely dynamic
  value a class can't express (e.g. a runtime chart color via CSS variable).
- **Spacing/typography uses Tailwind defaults** - the theme deliberately omits
  custom spacing/font-size/radius scales. Use `gap-4`, `space-y-4`, `px-4`,
  `container mx-auto`; `text-2xl`/`text-sm`, `font-semibold`, `tracking-tight`,
  `text-muted-foreground` for hierarchy.
- **Never `transition-all`** - animate specific properties (`transition-colors`,
  `transition-transform`). Brand `--animate-*` tokens exist for entrances.
- **One component per file** - route-private composites live in the route's
  `_components/` (see `adding-ui-components` for the promotion rule).
- **Build mobile-first.** Start single-column, add `md:`/`lg:` breakpoints - every
  example page does (`md:grid-cols-2 lg:grid-cols-4`, `md:flex-row`).
- Use `cn()` from `@/lib/utils` to compose conditional classes; `initials()` is
  there too for avatar fallbacks.

## Reference files

- **`references/component-catalog.md`** - all 56 components grouped by purpose,
  each with a one-line "use when" and disambiguation from its neighbors.
- **`references/page-recipes.md`** - the composition patterns above as
  copy-adaptable JSX skeletons, each pointing to its worked example (a Storybook
  story under `Examples/*`, or the `app/` file for landing/auth).
- **`references/theming.md`** - semantic tokens, Material color scales,
  typography/spacing conventions, animation tokens, and dark mode.
