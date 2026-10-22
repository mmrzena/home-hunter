"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
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
  median: { label: "Median Kč/m²", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

function thousands(value: number): string {
  return `${Math.round(value / 1000)}k`;
}

export function PriceTrendChart({ weekly }: { weekly: WeeklyPoint[] }) {
  const data = weekly.map((point) => ({
    week: point.week,
    median: point.medianPpm2 == null ? null : Math.round(point.medianPpm2),
    band:
      point.lowerPpm2 == null || point.upperPpm2 == null
        ? null
        : [point.lowerPpm2, point.upperPpm2],
  }));
  return (
    <ChartContainer config={CONFIG} className="h-72 w-full">
      <ComposedChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} strokeOpacity={0.2} />
        <XAxis {...WEEK_X_AXIS} />
        <YAxis
          {...VALUE_Y_AXIS}
          width={44}
          tickFormatter={thousands}
          domain={["auto", "auto"]}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={weekTooltipLabel} />}
        />
        <Area
          dataKey="band"
          tooltipType="none"
          stroke="none"
          fill="var(--color-median)"
          fillOpacity={0.12}
        />
        <Line
          dataKey="median"
          stroke="var(--color-median)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ChartContainer>
  );
}
