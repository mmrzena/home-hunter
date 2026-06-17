"use client";

import { RiCloseLine, RiSearchLine } from "@remixicon/react";
import type { Column } from "@tanstack/react-table";
import * as React from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

type DataTableSearchProps<TData, TValue> = {
  column?: Column<TData, TValue>;
  placeholder?: string;
  /** Delay before the typed value hits the column filter. */
  debounceMs?: number;
  className?: string;
};

export function DataTableSearch<TData, TValue>({
  column,
  placeholder = "Search…",
  debounceMs = 300,
  className,
}: DataTableSearchProps<TData, TValue>) {
  const external = (column?.getFilterValue() as string) ?? "";
  const [value, setValue] = React.useState(external);

  // Snap the input back to the column value when it changes from the outside
  // (e.g. a toolbar Reset) — the "adjust state during render" pattern, so no
  // effect is needed to keep the controlled input in sync.
  const [prevExternal, setPrevExternal] = React.useState(external);
  if (external !== prevExternal) {
    setPrevExternal(external);
    setValue(external);
  }

  const timeout = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  function handleChange(next: string) {
    setValue(next);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      column?.setFilterValue(next || undefined);
    }, debounceMs);
  }

  function handleClear() {
    clearTimeout(timeout.current);
    setValue("");
    column?.setFilterValue(undefined);
  }

  return (
    <InputGroup className={cn("h-8 w-full sm:w-64", className)}>
      <InputGroupAddon>
        <RiSearchLine className="size-4 text-muted-foreground" />
      </InputGroupAddon>
      <InputGroupInput
        placeholder={placeholder}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Clear search"
            onClick={handleClear}
          >
            <RiCloseLine />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
