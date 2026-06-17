"use client";

import { RiCalendarLine } from "@remixicon/react";
import type { Column, Row } from "@tanstack/react-table";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/** Serializable range stored as the column filter value. */
export type DateFilterValue = { from?: string; to?: string };

/**
 * Filter fn for a column whose value is a `Date` or ISO date string. Attach it
 * as the column's `filterFn` and drive it with `DataTableDateFilter`.
 */
export function dateRangeFilterFn<TData>(
  row: Row<TData>,
  columnId: string,
  filterValue: DateFilterValue,
): boolean {
  if (!filterValue?.from && !filterValue?.to) {
    return true;
  }
  const raw = row.getValue(columnId);
  const time = (raw instanceof Date ? raw : new Date(String(raw))).getTime();
  if (Number.isNaN(time)) {
    return false;
  }
  if (
    filterValue.from &&
    time < new Date(filterValue.from).setHours(0, 0, 0, 0)
  ) {
    return false;
  }
  if (
    filterValue.to &&
    time > new Date(filterValue.to).setHours(23, 59, 59, 999)
  ) {
    return false;
  }
  return true;
}

type DataTableDateFilterProps<TData, TValue> = {
  column?: Column<TData, TValue>;
  title: string;
  className?: string;
};

export function DataTableDateFilter<TData, TValue>({
  column,
  title,
  className,
}: DataTableDateFilterProps<TData, TValue>) {
  const value = column?.getFilterValue() as DateFilterValue | undefined;
  const range: DateRange | undefined = value
    ? {
        from: value.from ? new Date(value.from) : undefined,
        to: value.to ? new Date(value.to) : undefined,
      }
    : undefined;

  function handleSelect(next: DateRange | undefined) {
    if (!next?.from && !next?.to) {
      column?.setFilterValue(undefined);
      return;
    }
    column?.setFilterValue({
      from: next.from ? format(next.from, "yyyy-MM-dd") : undefined,
      to: next.to ? format(next.to, "yyyy-MM-dd") : undefined,
    });
  }

  const label = range?.from
    ? range.to
      ? `${format(range.from, "MMM d")} – ${format(range.to, "MMM d")}`
      : format(range.from, "MMM d, yyyy")
    : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("border-dashed", className)}
        >
          <RiCalendarLine className="size-4" />
          {title}
          {label ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-4" />
              <span className="text-foreground">{label}</span>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          numberOfMonths={2}
          autoFocus
        />
        {range ? (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => column?.setFilterValue(undefined)}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
