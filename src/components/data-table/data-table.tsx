"use client";

import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import type * as React from "react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableProps<TData> = {
  table: TanstackTable<TData>;
  /** Rendered in place of the rows when the filtered set is empty. */
  empty?: React.ReactNode;
  className?: string;
};

function DefaultEmpty() {
  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyTitle>No results</EmptyTitle>
        <EmptyDescription>
          Nothing matches the current filters.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/**
 * Renders a `useReactTable` instance — header + body via `flexRender`, inside a
 * bordered surface, with an empty fallback. Column defs own the cell markup;
 * this just lays them out. Pair with `DataTableToolbar` (filters) above and
 * `DataTablePagination` below.
 */
export function DataTable<TData>({
  table,
  empty,
  className,
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const columnCount = table.getVisibleLeafColumns().length;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border",
        className,
      )}
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columnCount} className="py-0">
                {empty ?? <DefaultEmpty />}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
