# Theming

The theme is `src/styles/theme.css` (imported by `app/globals.css` alongside
Tailwind v4). Three layers: **(1)** semantic shadcn tokens, **(2)** Material-style
color scales, **(3)** keyframe/animation tokens. It deliberately does **not**
define spacing, font-size, or border-radius scales - those stay on Tailwind's
defaults.

## Semantic tokens (use these first)

Each `--token` is exposed as a Tailwind color utility. They are redefined under
`.dark`, so using them gets dark mode for free. Never hardcode the underlying
hex.

| Token | Utilities | Use for |
| --- | --- | --- |
| `--background` / `--foreground` | `bg-background`, `text-foreground` | page surface + body text |
| `--card` / `--card-foreground` | `bg-card`, `text-card-foreground` | card surfaces |
| `--popover` / `--popover-foreground` | `bg-popover`, … | floating panels |
| `--primary` / `--primary-foreground` | `bg-primary`, `text-primary`, `text-primary-foreground` | primary actions, brand accents (SM-Teal) |
| `--secondary` / `--secondary-foreground` | `bg-secondary`, … | secondary buttons/badges |
| `--muted` / `--muted-foreground` | `bg-muted`, `text-muted-foreground` | subtle fills, descriptions, helper text |
| `--accent` / `--accent-foreground` | `bg-accent`, `hover:bg-accent/40` | hover/active surfaces |
| `--destructive` | `bg-destructive`, `text-destructive` | delete/error |
| `--success` / `--warning` / `--info` | `text-success`, `bg-warning`, `text-info` | status semantics |
| `--border` / `--input` | `border`, `border-input` | dividers, field borders |
| `--ring` | `ring-ring`, `outline-ring` | focus rings |
| `--chart-1`…`--chart-5` | `var(--color-chart-N)` | data-viz series (→ `building-charts`) |
| `--sidebar*` | `bg-sidebar`, … | sidebar internals (handled by `DashboardLayout`) |

Opacity modifiers are idiomatic: `bg-primary/10`, `bg-muted/40`,
`hover:bg-accent/40`, `outline-ring/50`.

`--radius` is `0.625rem`; `rounded-sm/md/lg/xl` derive from it via `@theme`. Use
the `rounded-*` utilities, not a raw radius.

## Material color scales (when tokens aren't enough)

24 families, each `50`-`900`, exposed as utilities like `bg-SM-Teal-500`,
`text-blueGrey-600`, `border-blue-200`. Reach for these only when a semantic
token can't express the need - a fixed categorical color (tags, a legend), or a
specific tint/shade. Default to semantic tokens so dark mode keeps working;
scales are fixed values and do **not** flip with the theme.

Families: `blueGrey`, `grey`, `SM-Teal` (brand teal - 500 = `#5fae9f`), `blue`,
`lightBlue`, `indigo`, `deepPurple`, `purple`, `pink`, `red`, `deepOrange`,
`orange`, `amber`, `yellow`, `lime`, `lightGreen`, `green`, `cyan`. Convention:
`50` lightest → `900` darkest; camelCase family names (`blueGrey`, `lightBlue`,
`deepPurple`, `SM-Teal`).

## Typography

Open Sans is bound to `--font-sans` (loaded by `next/font/google` in
`app/layout.tsx`) and applied to `body` in the base layer - no per-component font
classes needed. Build hierarchy with Tailwind's default scale:

- Page title (in `PageHeader`): `text-2xl font-semibold tracking-tight`.
- Marketing hero: `text-4xl font-bold tracking-tight md:text-6xl` + `text-balance`.
- Card title: default, or `text-base` for compact cards.
- Body/secondary: `text-sm text-muted-foreground`; fine print: `text-xs`.
- IDs/code: `font-mono text-xs`; inline code: `rounded bg-muted px-1.5 py-0.5 text-sm`.

## Spacing & layout

No custom spacing scale - use Tailwind defaults. Recurring values:

- Section/grid gaps: `gap-4`; stacked fields: `space-y-4` (or `space-y-6` between
  setting blocks).
- Page horizontal rhythm: `container mx-auto px-4` (marketing); the dashboard
  content area already has `px-4 py-6 md:px-6`.
- Stack cards down a page with `mt-4`.
- Mobile-first: start one column, widen with `md:`/`lg:`
  (`grid gap-4 md:grid-cols-2 lg:grid-cols-4`, `flex-col md:flex-row`).

## Animation tokens

Keyframes ship as `--animate-*` tokens (use as `animate-[var(--animate-popIn)]`
or via component defaults):

- Entrances: `--animate-slideUpIn/Out`, `slideDownIn/Out`, `slideLeftIn/Out`,
  `slideRightIn/Out` (100ms).
- Emphasis: `--animate-popIn` (300ms snappy ease), `--animate-popOut` (150ms).
- Loops: `--animate-pulse-left`, `--animate-pulse-right` (1.6s infinite).

Rule: **never `transition-all`.** Animate the specific property -
`transition-colors` (hover fills), `transition-transform` (chevrons, scales).
The sidebar chevron and hover cards in the repo follow this.

## Dark mode

Dark mode is the `.dark` class on the root, toggled by `theme-toggle.tsx` /
`theme-provider.tsx` (drop `<ThemeToggle />` into a header's `actions` or
`DashboardLayout`'s `topBarActions`). Because every component is built on the
semantic tokens, designs work in both modes automatically - provided you use
tokens, never fixed colors or `dark:`-prefixed hex overrides.

## Helpers

- **`cn()`** (`@/lib/utils`) - merge/condition Tailwind classes
  (clsx + tailwind-merge): `cn("text-sm", isUp ? "text-success" : "text-destructive")`.
- **`initials()`** (`@/lib/utils`) - first letters of a name for `AvatarFallback`.
