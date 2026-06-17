"use client";

import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import type { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataTablePaginationProps<TData> = {
  table: Table<TData>;
  /** Noun for the row count, e.g. "shipment" → "12 shipment(s)". */
  unit?: string;
  className?: string;
};

/**
 * Filtered row count + page indicator + prev/next, driven by the table's
 * pagination row model. Requires `getPaginationRowModel()` on the table.
 */
export function DataTablePagination<TData>({
  table,
  unit = "row",
  className,
}: DataTablePaginationProps<TData>) {
  // `getRowCount()` honors a manually-set `rowCount` (server-side total) and
  // falls back to the filtered client row count otherwise.
  const total = table.getRowCount();
  const selected = table.getFilteredSelectedRowModel().rows.length;

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <p className="text-sm text-muted-foreground">
        {selected > 0
          ? `${selected} of ${total} selected`
          : `${total} ${unit}(s)`}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount() || 1}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <RiArrowLeftSLine />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <RiArrowRightSLine />
        </Button>
      </div>
    </div>
  );
}
