"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { WeeklyPoint } from "@/lib/market-trends";
import {
  CHART_MARGIN,
  VALUE_Y_AXIS,
  WEEK_X_AXIS,
  weekTooltipLabel,
} from "./chart-format";

const CONFIG = {
  newListings: { label: "Newly listed", color: "var(--color-chart-2)" },
  gone: { label: "Went off the market", color: "var(--color-chart-4)" },
} satisfies ChartConfig;

export function FlowChart({ weekly }: { weekly: WeeklyPoint[] }) {
  return (
    <ChartContainer config={CONFIG} className="h-56 w-full">
      <BarChart data={weekly} margin={CHART_MARGIN} barGap={2}>
        <CartesianGrid vertical={false} strokeOpacity={0.2} />
        <XAxis {...WEEK_X_AXIS} />
        <YAxis {...VALUE_Y_AXIS} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={weekTooltipLabel} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="newListings"
          fill="var(--color-newListings)"
          radius={[4, 4, 0, 0]}
        />
        <Bar dataKey="gone" fill="var(--color-gone)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
