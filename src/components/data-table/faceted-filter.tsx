"use client";

import { RiAddCircleLine, RiCheckLine } from "@remixicon/react";
import type { Column } from "@tanstack/react-table";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { FacetedFilterOption } from "./types";

type DataTableFacetedFilterProps<TData, TValue> = {
  column?: Column<TData, TValue>;
  title: string;
  options: FacetedFilterOption[];
  /**
   * Allow several values at once (checkbox list, the default). Set `false` for
   * a single-select that swaps the value and closes on pick (radio list).
   */
  multiple?: boolean;
};

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
  multiple = true,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const [open, setOpen] = React.useState(false);
  const facets = column?.getFacetedUniqueValues();
  const selected = new Set((column?.getFilterValue() as string[]) ?? []);
  const selectedOptions = options.filter((option) =>
    selected.has(option.value),
  );

  function handleSelect(value: string) {
    if (multiple) {
      const next = new Set(selected);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      const values = Array.from(next);
      column?.setFilterValue(values.length ? values : undefined);
      return;
    }
    const next = selected.has(value) ? [] : [value];
    column?.setFilterValue(next.length ? next : undefined);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <RiAddCircleLine className="size-4" />
          {title}
          {selectedOptions.length > 0 ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-4" />
              {multiple ? (
                <>
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal lg:hidden"
                  >
                    {selected.size}
                  </Badge>
                  <div className="hidden gap-1 lg:flex">
                    {selectedOptions.length > 2 ? (
                      <Badge
                        variant="secondary"
                        className="rounded-sm px-1 font-normal"
                      >
                        {selected.size} selected
                      </Badge>
                    ) : (
                      selectedOptions.map((option) => (
                        <Badge
                          key={option.value}
                          variant="secondary"
                          className="rounded-sm px-1 font-normal"
                        >
                          {option.label}
                        </Badge>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <span className="text-foreground">
                  {selectedOptions[0]?.label}
                </span>
              )}
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value);
                // Prefer a caller-supplied count (server-side data); fall back
                // to the client-computed facet count when present.
                const count = option.count ?? facets?.get(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center border border-input",
                        multiple ? "rounded-[4px]" : "rounded-full",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "[&_svg]:invisible",
                      )}
                    >
                      <RiCheckLine className="size-3 text-current" />
                    </span>
                    {option.icon ? (
                      <option.icon className="size-4 text-muted-foreground" />
                    ) : null}
                    <span>{option.label}</span>
                    {count !== undefined ? (
                      <span className="ml-auto font-mono text-xs text-muted-foreground">
                        {count}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.size > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column?.setFilterValue(undefined)}
                    className="justify-center text-center"
                  >
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
