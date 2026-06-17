"use client";

import { RiCloseLine } from "@remixicon/react";
import type { Table } from "@tanstack/react-table";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DataTableActiveFilters } from "./active-filters";

type DataTableToolbarProps<TData> = {
  table: Table<TData>;
  /** The filter controls — `DataTableSearch`, `DataTableFacetedFilter`, … */
  children?: React.ReactNode;
  /** Right-aligned slot (e.g. a "Create" button or column-visibility menu). */
  actions?: React.ReactNode;
  className?: string;
};

export function DataTableToolbar<TData>({
  table,
  children,
  actions,
  className,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
          >
            Reset
            <RiCloseLine className="size-4" />
          </Button>
        ) : null}
        {actions ? <div className="ml-auto">{actions}</div> : null}
      </div>
      <DataTableActiveFilters table={table} />
    </div>
  );
}
