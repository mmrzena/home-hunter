import type { RowData } from "@tanstack/react-table";
import type * as React from "react";

export type DataTableFilterVariant = "text" | "faceted" | "date";

export type FacetedFilterOption = {
  label: string;
  value: string;
  /** Optional leading glyph — a status dot, a Remix icon, etc. */
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * Result count shown after the label. Supply this for server-side data;
   * client-side tables fall back to `column.getFacetedUniqueValues()`.
   */
  count?: number;
};

/**
 * Per-column display hints, read by `DataTableActiveFilters` so it can render
 * removable chips that map stored filter values back to human labels. Set via
 * `columnDef.meta` on filterable columns.
 */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    filterVariant?: DataTableFilterVariant;
    options?: FacetedFilterOption[];
  }
}
