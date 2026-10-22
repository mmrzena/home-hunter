"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
  active: { label: "On the market", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

export function SupplyChart({ weekly }: { weekly: WeeklyPoint[] }) {
  return (
    <ChartContainer config={CONFIG} className="h-56 w-full">
      <AreaChart data={weekly} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} strokeOpacity={0.2} />
        <XAxis {...WEEK_X_AXIS} />
        <YAxis {...VALUE_Y_AXIS} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={weekTooltipLabel} />}
        />
        <Area
          dataKey="active"
          stroke="var(--color-active)"
          strokeWidth={2}
          fill="var(--color-active)"
          fillOpacity={0.15}
        />
      </AreaChart>
    </ChartContainer>
  );
}
