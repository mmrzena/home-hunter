"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
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
  priceCuts: { label: "Price cuts", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

export function PriceCutsChart({ weekly }: { weekly: WeeklyPoint[] }) {
  return (
    <ChartContainer config={CONFIG} className="h-56 w-full">
      <BarChart data={weekly} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} strokeOpacity={0.2} />
        <XAxis {...WEEK_X_AXIS} />
        <YAxis {...VALUE_Y_AXIS} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={weekTooltipLabel} />}
        />
        <Bar
          dataKey="priceCuts"
          fill="var(--color-priceCuts)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
