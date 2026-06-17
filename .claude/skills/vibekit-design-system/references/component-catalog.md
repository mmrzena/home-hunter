# Component catalog

All 56 shadcn/ui primitives live in `src/components/ui/`, imported as
`@/components/ui/<name>`. Two app-level composites live one level up:
`@/components/date-picker` and `@/components/theme-toggle`.

Each entry is a one-line **use when** plus, where it matters, how it differs from
a neighbor. Chart internals are out of scope (→ `building-charts`); form wiring
with react-hook-form/zod is out of scope (→ `state-management`).

## Forms & inputs

- **`button`** - primary action trigger. Variants: `default`, `outline`,
  `ghost`, `secondary`, `destructive`, `link`; sizes: `sm`, `default`, `lg`,
  `icon`, `icon-sm`. Use `asChild` to render a `Link` as a button.
- **`button-group`** - segment related buttons into one attached control.
- **`input`** - single-line text/email/password/number field.
- **`textarea`** - multi-line text. Set `rows`.
- **`input-group`** - wrap an input with a leading/trailing addon
  (`InputGroupAddon` + `InputGroupInput`). The standard search box: addon holds
  `RiSearchLine`.
- **`input-otp`** - segmented one-time-code entry.
- **`label`** - accessible label; pair `htmlFor` with the field `id`.
- **`field`** - low-level labelled-field wrapper. Prefer `form.tsx`'s `FormItem`
  for react-hook-form; use `field` only for non-RHF layouts.
- **`form`** - react-hook-form bindings: `Form`, `FormField`, `FormItem`,
  `FormLabel`, `FormControl`, `FormMessage`, `FormDescription`. The repo standard
  for any validated form.
- **`select`** - choose one from a short, known list (styled dropdown).
- **`native-select`** - semantic `<select>`; use for very long lists or where
  native mobile pickers are preferable.
- **`combobox`** - choose one from many with type-to-filter. Use over `select`
  when the option count is large or searchable.
- **`checkbox`** - boolean in a list / multi-select / consent. For a standalone
  on/off setting prefer `switch`.
- **`radio-group`** - pick exactly one when all options should stay visible
  (≤ ~5). Otherwise use `select`.
- **`switch`** - instant on/off toggle for a single setting.
- **`toggle`** - a button that holds a pressed/unpressed state (e.g. bold).
- **`toggle-group`** - a set of toggles; single or multiple selection. Good for
  a view-mode or formatting toolbar.
- **`slider`** - pick a number (or range) along a track. Value is an array.
- **`calendar`** - month grid date selection (the primitive behind `DatePicker`).
- **`date-picker`** (`@/components/date-picker`) - the ready composite: button +
  popover + calendar. Use this for date fields, not a raw `Input` or bare
  `Calendar`. Props: `value`, `onChange`, `placeholder`, `id`.

## Overlays & dialogs

- **`dialog`** - modal for a focused task/form that interrupts the page.
- **`alert-dialog`** - confirmation modal with explicit action/cancel. Use for
  destructive or irreversible confirmations - not `dialog`.
- **`sheet`** - panel sliding from an edge; keeps page context visible. Prefer
  over `dialog` for create/edit when the underlying list still matters.
- **`drawer`** - bottom-sheet style (mobile-friendly). Use when the gesture/feel
  of a drawer fits; otherwise `sheet`.
- **`popover`** - click-triggered floating panel for rich content (filters,
  pickers). Click, not hover.
- **`hover-card`** - hover-triggered preview of an entity. For rich content on
  hover; for plain text use `tooltip`.
- **`tooltip`** - short text hint on hover/focus. Text only.
- **`context-menu`** - right-click menu bound to a region.

## Navigation

- **`dropdown-menu`** - actions/menu off a trigger button. The row-action "⋯"
  menu in tables. Supports `DropdownMenuItem variant="destructive"`, separators,
  checkbox/radio items, shortcuts.
- **`navigation-menu`** - horizontal top-nav with flyout panels (marketing nav).
- **`menubar`** - desktop-app-style menu bar (File/Edit/…).
- **`breadcrumb`** - show location in a hierarchy.
- **`tabs`** - switch between sibling panels (`TabsList` + `TabsTrigger` +
  `TabsContent`). Can also drive a segmented filter without `TabsContent` (see
  shipments page).
- **`pagination`** - page through a long list. Pairs with the data-table recipe.
- **`sidebar`** - the full collapsible app sidebar system. Don't use directly;
  it's composed by `DashboardLayout`. Reach for `DashboardLayout` instead.

## Data display

- **`card`** - the default content container: `Card` + `CardHeader` +
  `CardTitle`/`CardDescription` + `CardContent` + `CardFooter`. The unit nearly
  every dashboard section is built from.
- **`table`** - rows/columns of structured data (`TableHeader`/`TableBody`/
  `TableRow`/`TableHead`/`TableCell`). See the data-table recipe.
- **`badge`** - compact status/label. Variants `default`/`secondary`/`outline`/
  `destructive`; map status → variant via a lookup object.
- **`avatar`** - user/entity image with `AvatarFallback` (use `initials()` from
  `@/lib/utils`).
- **`progress`** - determinate completion bar (`value` 0-100).
- **`item`** - list-row primitive (`Item`, `ItemContent`, `ItemTitle`,
  `ItemDescription`, `ItemActions`, `ItemGroup`, `ItemSeparator`). Build
  setting/notification rows from it (see `NotifyItem`).
- **`empty`** - empty/zero-results *and* not-found states (`Empty`,
  `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `EmptyContent`).
  Use inside a table cell with `className="border-0"`; it's also the 404 page
  (`app/not-found.tsx`).
- **`skeleton`** - placeholder block while a region loads (preserves layout).
- **`kbd`** - render a keyboard key/shortcut.
- **`aspect-ratio`** - lock a media box to a ratio.

## Feedback & status

- **`alert`** - persistent inline message (info/warning/error) within the page.
- **`sonner`** - toast notifications. Call `toast()` for transient confirmations
  ("Saved", "Failed to save"). `<Toaster />` is mounted once in the app shell.
- **`spinner`** - inline loading indicator for a pending action/button.

## Layout & structure

- **`separator`** - thin divider between sections.
- **`accordion`** - vertically stacked collapsible sections; one or many open.
- **`collapsible`** - a single show/hide region (the primitive behind sidebar
  groups).
- **`scroll-area`** - styled, cross-browser scroll container for an overflowing
  region.
- **`resizable`** - drag-to-resize split panes.
- **`carousel`** - horizontally paged content/media.
- **`direction`** - RTL/LTR direction provider utility.

## Command & utility

- **`command`** - command palette / fuzzy list (`CommandDialog` for ⌘K). Also the
  searchable engine behind `combobox`.
- **`theme-toggle`** (`@/components/theme-toggle`) - light/dark switch button;
  drop into `DashboardLayout`'s `topBarActions` or a header's `actions`.

## Charts

- **`chart`** - the recharts wrapper (`ChartContainer`, `ChartTooltip`,
  `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`). Required wrapper
  for all data-viz. Full guidance: the `building-charts` skill.

## Quick disambiguation

- **Dialog vs AlertDialog vs Sheet vs Drawer** - focused task → `Dialog`;
  confirm destructive → `AlertDialog`; keep page context / longer form → `Sheet`;
  mobile bottom-sheet feel → `Drawer`.
- **Select vs Combobox vs native-select** - few known options → `Select`; many /
  searchable → `Combobox`; long native list or mobile-native → `native-select`.
- **Switch vs Checkbox vs Toggle** - single setting → `Switch`; multi-select /
  consent → `Checkbox`; pressed-state button → `Toggle`.
- **HoverCard vs Tooltip vs Popover** - rich preview on hover → `HoverCard`;
  short text on hover → `Tooltip`; rich content on click → `Popover`.
- **Alert vs Sonner** - stays on the page → `Alert`; transient/dismiss-itself →
  `Sonner` toast.
- **Skeleton vs Spinner vs Progress** - region placeholder → `Skeleton`; inline
  pending → `Spinner`; known percentage → `Progress`.
