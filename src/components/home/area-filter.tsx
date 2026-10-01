"use client";

import { RiCheckLine } from "@remixicon/react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AreaFacet } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Lowercase without diacritics, so "brandys" finds "Brandýs nad Labem". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// Every word of the query must appear somewhere in the area's name.
function matchesQuery(area: AreaFacet, words: string[]): boolean {
  const name = normalize(area.name);
  return words.every((word) => name.includes(word));
}

export function AreaFilter({
  areas,
  selected,
  onToggle,
  onClear,
}: {
  areas: AreaFacet[];
  selected: string[];
  onToggle: (code: string, isChecked: boolean) => void;
  onClear: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const words = normalize(query).split(/\s+/).filter(Boolean);
  // Filtered here rather than by cmdk, which re-sorts the DOM by match score
  // and never restores it, so "Selected" could end up below other areas.
  const visible = areas.filter((area) => matchesQuery(area, words));
  const chosen = visible.filter((area) => selected.includes(area.code));
  const rest = visible.filter((area) => !selected.includes(area.code));
  const selectedCount = selected.length;

  function handleQueryChange(next: string) {
    setQuery(next);
    // After the re-render, or the browser keeps the old offset in the new list.
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: 0 }));
  }

  function renderItem(area: AreaFacet, isChecked: boolean) {
    return (
      <CommandItem
        key={area.code}
        value={area.code}
        onSelect={() => onToggle(area.code, !isChecked)}
      >
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
            isChecked && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {isChecked && <RiCheckLine className="size-3 text-current" />}
        </span>
        <span className="flex-1 truncate">{area.name}</span>
        <span className="text-xs text-muted-foreground">{area.count}</span>
      </CommandItem>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          Areas
          {selected.length > 0 && (
            <Badge variant="secondary">{selected.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search ${areas.length} areas…`}
            value={query}
            onValueChange={handleQueryChange}
          />
          {selectedCount > 0 && (
            <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
              {selectedCount} selected
              <button
                type="button"
                onClick={onClear}
                className="font-medium text-primary hover:underline"
              >
                Clear
              </button>
            </div>
          )}
          <CommandList ref={listRef} className="max-h-80">
            <CommandEmpty>No area matches.</CommandEmpty>
            {chosen.length > 0 && (
              <CommandGroup heading="Selected">
                {chosen.map((area) => renderItem(area, true))}
              </CommandGroup>
            )}
            <CommandGroup heading={chosen.length > 0 ? "All areas" : undefined}>
              {rest.map((area) => renderItem(area, false))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
