---
name: building-charts
description: Build data-viz / charts in this repo using recharts wrapped in the shadcn ChartContainer, with ShipMonk theme colors via CSS variables. Use when adding a chart, graph, trend line, bar/area/line/pie/donut, KPI sparkline, or any data visualization.
---

# Building charts in this starter kit

Charts use **recharts** (installed) wrapped in the shadcn **chart** primitive
(`src/components/ui/chart.tsx`). Don't reach for another charting library and
don't render bare recharts without the wrapper — the wrapper supplies theming,
tooltips, and legends consistent with the rest of the UI.

## Rules

1. **Always wrap in `ChartContainer`** with a typed `ChartConfig`. It injects the
   CSS variables the theme tooltip/legend read. (One existing chart in
   `analytics/page.tsx` rolls its own donut legend — match the `ChartContainer`
   pattern instead when adding new charts.)

2. **Colors come from CSS variables, never hex.** Use `var(--color-primary)`,
   `var(--color-chart-2)`, … so charts track the ShipMonk light/dark theme.

3. **A chart is a client component.** recharts needs the browser. Put it in the
   route's `_components/` folder with `"use client"` at the top and import it
   into the (server) page — see the `OrdersChart` in
   `stories/examples/DashboardOverview.stories.tsx`. Keep chart-specific
   config inside that component; pass the data in as props in a real app.

4. **Use `ChartTooltip` + `ChartTooltipContent`** for tooltips and, when a legend
   is needed, `ChartLegend` + `ChartLegendContent` from `@/components/ui/chart`
   rather than hand-building swatches.

5. **Style axis ticks with `tick={AXIS_TICK}` from `@/lib/chart`.** Do NOT rely
   on CSS overriding recharts' tick `fill`, and do NOT pass a color via the
   `fill` attribute — `var()` does not resolve in SVG presentation attributes, so
   the tick text comes out the wrong color (notably invisible/low-contrast in
   dark mode). `AXIS_TICK` sets the color through an inline `style`, where the
   CSS variable resolves and tracks the theme:

   ```tsx
   import { AXIS_TICK } from "@/lib/chart";
   <XAxis dataKey="day" tickLine={false} axisLine={false} tick={AXIS_TICK} />
   <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} />
   ```

## Canonical pattern

```tsx
"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { AXIS_TICK } from "@/lib/chart";

const data = [{ day: "Mon", orders: 142 } /* … */];
const config: ChartConfig = {
  orders: { label: "Orders", color: "var(--color-primary)" },
};

export function OrdersChart() {
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid vertical={false} strokeOpacity={0.2} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={AXIS_TICK} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area type="monotone" dataKey="orders" stroke="var(--color-primary)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
```

Worked examples (in Storybook): `stories/examples/DashboardOverview.stories.tsx`
(area) and `stories/examples/Analytics.stories.tsx` (bar / line / donut). The
shared `AXIS_TICK` theming helper lives in `@/lib/chart`.
