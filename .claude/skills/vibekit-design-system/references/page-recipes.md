# Page recipes

Composition patterns lifted from the repo's own UI. Each is a trimmed skeleton
plus a worked example to read for the full version — a Storybook story under
`Examples/*` (`stories/examples/`) for the dashboard screens, or the `app/` file
for the landing and auth pages. All imports use the `@/` alias; copy the import
lines from the cited file.

A dashboard page is a Server Component by default - add `"use client"` only when
it holds interactive state (search/filter/dialog), as the Shipments, Customers,
and Settings examples do. The dashboard *shell* itself is a route segment's
`layout.tsx` wrapping `DashboardLayout` - see the wiring recipe just below.

## Dashboard layout wiring (`app/<segment>/layout.tsx`)

`/app` ships only the landing + sign-in pages; there is no dashboard route by
default. Add one when you need it: `DashboardLayout` is router-agnostic, so a
dashboard area is a route segment whose `layout.tsx` wraps `children` in it and
feeds active state from `usePathname()`. That `layout.tsx` is a Client Component
(`"use client"`); the pages under it stay Server Components. The `Examples/*`
Storybook stories render this shell through the `ExampleDashboard` helper.

```tsx
"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { RiHomeLine, RiFileChartLine, RiFileListLine } from "@remixicon/react";
import { DashboardLayout } from "@/components/layout";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DashboardChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;
  return (
    <DashboardLayout
      brand={<Link href="/">{/* <Logo /> */}</Link>}
      topBarActions={<ThemeToggle />}
      navGroups={[
        { label: "Overview", items: [
          { href: "/dashboard", label: "Home", icon: <RiHomeLine />, active: isActive("/dashboard") },
          // a parent with `items` renders a collapsible nested group:
          { label: "Reports", icon: <RiFileChartLine />, active: pathname.startsWith("/dashboard/reports"),
            items: [{ href: "/dashboard/reports/orders", label: "Orders", icon: <RiFileListLine />,
              active: isActive("/dashboard/reports/orders") }] },
        ] },
      ]}
    >
      {children}
    </DashboardLayout>
  );
}
```

Nav items take `href`, `label`, `icon`, `active`; pages under the segment are
just content opening with a `<PageHeader>`.

## KPI / stat grid

Four metrics across, collapsing responsively. Each is a `Card` with a label
(`CardDescription`), a big value (`CardTitle`), and a delta line tinted by
direction. Worked example: `stories/examples/DashboardOverview.stories.tsx`.

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {kpis.map((kpi) => (
    <Card key={kpi.label}>
      <CardHeader className="pb-2">
        <CardDescription>{kpi.label}</CardDescription>
        <CardTitle className="text-2xl">{kpi.value}</CardTitle>
      </CardHeader>
      <CardContent>
        <span className={cn("inline-flex items-center gap-1 text-sm",
          kpi.up ? "text-success" : "text-destructive")}>
          {kpi.delta} vs last week
        </span>
      </CardContent>
    </Card>
  ))}
</div>
```

## Content + sidebar split

Primary panel two-thirds wide, secondary one-third, stacking below `lg`. Worked
example: `stories/examples/DashboardOverview.stories.tsx`.

```tsx
<div className="mt-4 grid gap-4 lg:grid-cols-3">
  <Card className="lg:col-span-2">{/* chart / primary content */}</Card>
  <Card>{/* list / secondary content */}</Card>
</div>
```

## Chart card

A `Card` wrapping a `ChartContainer`. Charts are client components in the route's
`_components/`. Full guidance is the **`building-charts`** skill; worked examples:
`stories/examples/DashboardOverview.stories.tsx`, `stories/examples/Analytics.stories.tsx`.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Last 7 days</CardTitle>
    <CardDescription>Orders & revenue trend</CardDescription>
  </CardHeader>
  <CardContent>
    <OrdersChart />
  </CardContent>
</Card>
```

## Data table — lightweight (manual `useState` filtering)

The workhorse list screen: a segmented `Tabs` control, a `Card` whose header
holds a result count + search `InputGroup` + `Select` filter, a `Table` with a
status `Badge` and a row-action `DropdownMenu`, an `Empty` fallback, and
`Pagination` below. State is `useState` (→ `state-management`). Reach for this
when the data is small and the filtering is one or two fields. (No separate
story ships for it — the `Examples/Shipments` story uses the **filter toolkit**
below.) For richer filtering — faceted multi-select, active-filter chips,
sorting, larger datasets — use the toolkit recipe below instead.

```tsx
"use client";
// imports: PageHeader, Button, Card*, Table*, Badge, DropdownMenu*, Empty*,
// InputGroup*, Select*, Tabs*, Pagination* - see the real file

<PageHeader title="Shipments" description="…" actions={<Button>Create shipment</Button>} />

<Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-4">
  <TabsList>
    <TabsTrigger value="all">All</TabsTrigger>
    <TabsTrigger value="active">Active</TabsTrigger>
  </TabsList>
</Tabs>

<Card>
  <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <CardTitle className="text-base">{filtered.length} results</CardTitle>
    <div className="flex flex-col gap-2 md:flex-row">
      <InputGroup className="md:w-72">
        <InputGroupAddon><RiSearchLine className="size-4 text-muted-foreground" /></InputGroupAddon>
        <InputGroupInput placeholder="Search…" value={search}
          onChange={(event) => setSearch(event.target.value)} />
      </InputGroup>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="md:w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
        <SelectContent>{/* SelectItem per status */}</SelectContent>
      </Select>
    </div>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="py-0">
              <Empty className="border-0">
                <EmptyHeader>
                  <EmptyTitle>No shipments</EmptyTitle>
                  <EmptyDescription>No shipments match those filters.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </TableCell>
          </TableRow>
        ) : (
          filtered.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.id}</TableCell>
              <TableCell><Badge variant={SHIPMENT_STATUS_BADGE_VARIANT[row.status]}>{row.status}</Badge></TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Row actions"><RiMoreLine /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Track package</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">Cancel</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </CardContent>
</Card>

<Pagination className="mt-4">{/* PaginationPrevious / PaginationLink / PaginationNext */}</Pagination>
```

Map status → `Badge` variant with a lookup object (e.g.
`SHIPMENT_STATUS_BADGE_VARIANT` in `stories/mocks/shipments.ts`), not inline
conditionals.

## Filterable data table (TanStack + filter toolkit)

For high-usage list screens, build on **TanStack Table** and the filter toolkit
in `@/components/data-table` — don't hand-roll the table shell, faceted filters,
or chips. The toolkit ships:

- `DataTable` — renders a `useReactTable` instance (header + body via
  `flexRender`) inside a bordered surface, with an `empty` fallback slot.
- `DataTablePagination` — filtered row count (or selected-row count) + page
  indicator + prev/next.
- `selectionColumn()` — *optional* leading checkbox column (select-all header
  with an indeterminate state + per-row). Off by default — opt in by spreading
  it into `columns`, setting `enableRowSelection: true`, and setting `getRowId`
  so selection survives paging/filtering; read it back via
  `table.getFilteredSelectedRowModel()`.
- `DataTableToolbar` — lays out the filter controls, a **Reset** button (shown
  when any filter is active), and removable **active-filter chips**.
- `DataTableSearch` — debounced text filter bound to a column.
- `DataTableFacetedFilter` — popover checkbox list with per-option counts and
  selected pills; pass `multiple={false}` for a single-select (radio) variant.
- `DataTableDateFilter` + `dateRangeFilterFn` — range-calendar filter for a date
  column (attach `dateRangeFilterFn` as that column's `filterFn`).

Each filterable column carries display hints in `columnDef.meta`
(`label`, `filterVariant`, `options`) so the chips can map stored values back to
labels. Worked example: `stories/examples/Shipments.stories.tsx`.

```tsx
"use client";
const columns = [selectionColumn<Row>(), /* …your columns… */];
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
const [rowSelection, setRowSelection] = useState({});
const table = useReactTable({
  data, columns,
  state: { columnFilters, rowSelection },
  getRowId: (row) => row.id,           // stable selection across pages/filters
  enableRowSelection: true,
  onColumnFiltersChange: setColumnFilters,
  onRowSelectionChange: setRowSelection,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getFacetedRowModel: getFacetedRowModel(),
  getFacetedUniqueValues: getFacetedUniqueValues(),
  getPaginationRowModel: getPaginationRowModel(),
});

<DataTableToolbar table={table}>
  <DataTableSearch column={table.getColumn("customer")} placeholder="Search…" />
  <DataTableFacetedFilter column={table.getColumn("status")} title="Status" options={STATUS_OPTIONS} />
  <DataTableFacetedFilter column={table.getColumn("carrier")} title="Carrier" options={CARRIER_OPTIONS} multiple={false} />
  <DataTableDateFilter column={table.getColumn("createdAt")} title="Created" />
</DataTableToolbar>

<DataTable table={table} className="mt-4" empty={<Empty>…</Empty>} />
<DataTablePagination table={table} unit="shipment" className="mt-4" />
```

Column with the date filter wired up:

```tsx
{ accessorKey: "createdAt", filterFn: dateRangeFilterFn,
  meta: { label: "Created", filterVariant: "date" } }
```

### Server-side filtering (API)

The filter controls are just controlled inputs over the table's column-filter
state, so they work unchanged against a backend. Switch the table to manual
mode, observe the filter + pagination state, and refetch — the components don't
need to know there's a server.

```tsx
const table = useReactTable({
  data, columns,
  state: { columnFilters, pagination },
  onColumnFiltersChange: setColumnFilters,
  onPaginationChange: setPagination,
  manualFiltering: true,          // don't filter client rows…
  manualPagination: true,         // …or paginate them
  rowCount: serverTotal,          // DataTablePagination reads table.getRowCount()
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
});

// Refetch whenever filters/pagination change (event-driven or in your data layer):
const params = { filters: columnFilters, page: pagination.pageIndex };
// → GET /api/shipments?…  then setData(rows) + setServerTotal(count)
```

Two server notes: drop `getFacetedRowModel`/`getFacetedUniqueValues` (those scan
client rows) and feed faceted counts in via each option's `count`
(`{ label, value, count }`); the date filter already stores a serializable
`{ from, to }` ready to drop into a query string.

## Create/edit form in a Dialog (react-hook-form + zod)

A `Dialog` triggered from `PageHeader` actions, holding a `Form`. Validation via
`zodResolver`; close on success by setting the open state in the submit handler.
Worked example: `stories/examples/Customers.stories.tsx`.

```tsx
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogTrigger asChild>
    <Button><RiAddLine /> Add customer</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add a new customer</DialogTitle>
      <DialogDescription>Demo-only - no data is persisted.</DialogDescription>
    </DialogHeader>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleCreate)} className="flex flex-col gap-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button type="submit">Create</Button>
        </DialogFooter>
      </form>
    </Form>
  </DialogContent>
</Dialog>
```

For a form that should keep the underlying list visible, swap `Dialog*` for
`Sheet*` (`Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`,
`SheetFooter`, `SheetClose`) - same `Form` body inside.

## Card grid with hover preview

A responsive grid of clickable `Card`s, each wrapped in a `HoverCard` that reveals
detail on hover. `Avatar` + `AvatarFallback` use `initials()`. Worked example:
`stories/examples/Customers.stories.tsx`.

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {items.map((item) => (
    <HoverCard key={item.id} openDelay={150}>
      <HoverCardTrigger asChild>
        <Card className="cursor-pointer transition-colors hover:bg-accent/40">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Avatar><AvatarFallback>{initials(item.name)}</AvatarFallback></Avatar>
            <div className="flex-1">
              <CardTitle className="text-base">{item.name}</CardTitle>
              <CardDescription className="text-xs">{item.email}</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">{/* detail */}</HoverCardContent>
    </HoverCard>
  ))}
</div>
```

## Tabbed settings

A `Tabs` with one `Card` per `TabsContent`; the card body is `space-y-4`/`-6`
form fields and a `CardFooter` save button. Build repeated setting rows as a
composite from `Item` (see `NotifyItem` in the story). Inputs here use plain
`Label` + `Input` (not RHF) for a static demo. Worked example:
`stories/examples/Settings.stories.tsx`.

```tsx
<Tabs defaultValue="profile">
  <TabsList>
    <TabsTrigger value="profile">Profile</TabsTrigger>
    <TabsTrigger value="notifications">Notifications</TabsTrigger>
  </TabsList>

  <TabsContent value="profile">
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How your account appears.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" defaultValue="Jane Doe" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="start-date">Start date</Label>
          <DatePicker id="start-date" value={startDate} onChange={setStartDate} placeholder="Select a date" />
        </div>
      </CardContent>
      <CardFooter className="justify-end"><Button>Save changes</Button></CardFooter>
    </Card>
  </TabsContent>

  <TabsContent value="notifications">
    <Card>
      <CardContent>
        <ItemGroup>
          <NotifyItem title="Shipment delivered" description="…" defaultChecked />
          <ItemSeparator />
          <NotifyItem title="Carrier delay" description="…" />
        </ItemGroup>
      </CardContent>
    </Card>
  </TabsContent>
</Tabs>
```

Route-private composite (e.g. the `NotifyItem` in `stories/examples/Settings.stories.tsx`):

```tsx
export function NotifyItem({ title, description, defaultChecked }) {
  return (
    <Item size="sm">
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
      <ItemActions><Switch defaultChecked={defaultChecked} /></ItemActions>
    </Item>
  );
}
```

## Marketing hero + feature cards

`MainLayout` with `header`/`footer` config, a centered hero section, and a
three-up feature grid. Real file: `app/page.tsx`.

```tsx
<MainLayout
  header={{ logo: <Link href="/"><ShipMonkLogo className="h-6 w-auto" /></Link>,
    nav: [{ href: "/", label: "Home" }],
    actions: <><ThemeToggle /><Button asChild size="sm"><Link href="/sign-in">Get started</Link></Button></> }}
  footer={{ copyright: <span>© ShipMonk</span>, links: [{ href: "/dashboard", label: "Dashboard" }] }}
>
  <section className="container mx-auto px-4 py-20 md:py-28">
    <div className="mx-auto max-w-2xl text-center">
      <Badge variant="secondary" className="mb-6">v0.1</Badge>
      <h1 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">Headline.</h1>
      <p className="mt-6 text-balance text-lg text-muted-foreground">Subhead.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg"><Link href="/dashboard">See the dashboard</Link></Button>
      </div>
    </div>
  </section>

  <section className="container mx-auto px-4 pb-24">
    <div className="grid gap-4 md:grid-cols-3">
      {features.map((feature) => (
        <Card key={feature.title}>
          <CardHeader>
            <div className="mb-2 inline-flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              {feature.icon}
            </div>
            <CardTitle>{feature.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{feature.body}</CardContent>
        </Card>
      ))}
    </div>
  </section>
</MainLayout>
```

## Centered auth card

No layout wrapper - center a `Card` on a muted full-height background. Real file:
`app/sign-in/page.tsx`.

```tsx
<div className="grid min-h-svh place-items-center bg-muted/40 p-4">
  <Card className="w-full max-w-md">
    <CardHeader className="items-center pt-8 text-center">
      <ShipMonkLogo className="h-8 w-auto" />
      <CardDescription className="mt-6 text-base">Sign in with your account</CardDescription>
    </CardHeader>
    <CardContent>
      <Button type="button" variant="outline" size="lg" className="w-full gap-3" onClick={handleSignIn}>
        <GoogleGLogo className="size-5" /> Sign in with Google
      </Button>
    </CardContent>
    <CardFooter className="justify-center">
      <p className="text-xs text-muted-foreground">Only @shipmonk.com accounts are allowed</p>
    </CardFooter>
  </Card>
</div>
```

## Not found / 404 page

`app/not-found.tsx` replaces Next's default 404. No layout wrapper - center the
`Empty` pattern on a muted full-height background (like the auth card), brand
logo above, one clear way back. Server Component; it renders inside the root
layout, so theme tokens + fonts apply. Real file: `app/not-found.tsx`.

```tsx
<main className="grid min-h-svh place-items-center bg-muted/40 p-4">
  <div className="flex w-full max-w-md flex-col items-center gap-8">
    <Link href="/" aria-label="…"><ShipMonkLogo className="h-6 w-auto" /></Link>
    <Empty className="border-0 bg-transparent">
      <EmptyHeader>
        <EmptyMedia variant="icon"><RiCompass3Line /></EmptyMedia>
        <p className="text-sm font-semibold tracking-widest text-primary">404</p>
        <EmptyTitle>Page not found</EmptyTitle>
        <EmptyDescription>The page you’re looking for doesn’t exist or may have moved.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild><Link href="/"><RiArrowLeftLine /> Back home</Link></Button>
      </EmptyContent>
    </Empty>
  </div>
</main>
```
