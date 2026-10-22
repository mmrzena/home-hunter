import type { ReactNode } from "react";
import { AXIS_TICK } from "@/lib/chart";
import { formatDayMonth } from "@/lib/format";

export const WEEK_X_AXIS = {
  dataKey: "week",
  tickLine: false,
  axisLine: false,
  tick: AXIS_TICK,
  minTickGap: 24,
  tickFormatter: formatDayMonth,
} as const;

export const VALUE_Y_AXIS = {
  tickLine: false,
  axisLine: false,
  tick: AXIS_TICK,
  width: 40,
  allowDecimals: false,
} as const;

export const CHART_MARGIN = { left: 0, right: 8 };

export function weekTooltipLabel(week: ReactNode): string {
  return formatDayMonth(String(week));
}
