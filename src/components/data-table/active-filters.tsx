"use client";

import { RiCloseLine } from "@remixicon/react";
import type { Table } from "@tanstack/react-table";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DateFilterValue } from "./date-filter";

type DataTableActiveFiltersProps<TData> = {
  table: Table<TData>;
  className?: string;
};

function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1 font-normal">
      <span className="text-muted-foreground">{label}:</span>
      {value}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="ml-0.5 rounded-sm opacity-60 transition-opacity hover:opacity-100"
      >
        <RiCloseLine className="size-3" />
      </button>
    </Badge>
  );
}

function formatDateRange(range: DateFilterValue): string {
  const from = range.from ? format(new Date(range.from), "MMM d") : null;
  const to = range.to ? format(new Date(range.to), "MMM d") : null;
  if (from && to) {
    return `${from} – ${to}`;
  }
  return from ?? to ?? "";
}

/**
 * Removable chips for every applied column filter, rendered from
 * `columnDef.meta` (label + faceted options). Returns nothing when no filter
 * is active. Pair with the Reset button in `DataTableToolbar`.
 */
export function DataTableActiveFilters<TData>({
  table,
  className,
}: DataTableActiveFiltersProps<TData>) {
  const filters = table.getState().columnFilters;
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {filters.map((filter) => {
        const column = table.getColumn(filter.id);
        if (!column) {
          return null;
        }
        const meta = column.columnDef.meta;
        const label = meta?.label ?? filter.id;

        if (meta?.filterVariant === "date") {
          return (
            <FilterChip
              key={filter.id}
              label={label}
              value={formatDateRange(filter.value as DateFilterValue)}
              onRemove={() => column.setFilterValue(undefined)}
            />
          );
        }

        if (Array.isArray(filter.value)) {
          return (filter.value as string[]).map((value) => {
            const option = meta?.options?.find((item) => item.value === value);
            return (
              <FilterChip
                key={`${filter.id}:${value}`}
                label={label}
                value={option?.label ?? value}
                onRemove={() => {
                  const rest = (filter.value as string[]).filter(
                    (item) => item !== value,
                  );
                  column.setFilterValue(rest.length ? rest : undefined);
                }}
              />
            );
          });
        }

        return (
          <FilterChip
            key={filter.id}
            label={label}
            value={String(filter.value)}
            onRemove={() => column.setFilterValue(undefined)}
          />
        );
      })}
    </div>
  );
}
