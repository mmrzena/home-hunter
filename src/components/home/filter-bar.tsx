"use client";

import { RiCloseLine, RiFilter3Line } from "@remixicon/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatSource } from "@/lib/format";
import type { AppConfig } from "@/lib/types";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "bestDeal", label: "Best deal" },
  { value: "priceAsc", label: "Cheapest" },
  { value: "priceDesc", label: "Priciest" },
  { value: "prague", label: "Closest to Prague" },
  { value: "train", label: "Closest to train" },
  { value: "distance", label: "Nearest" },
];

const SOURCES = ["sreality", "bezrealitky", "ceskereality"];

const FILTER_PREFS_KEY = "home-hunter:hidden-filters:v1";

export function FilterBar({ config }: { config: AppConfig | undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const commit = useCallback(
    (next: URLSearchParams) => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params);
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
      commit(next);
    },
    [params, commit],
  );

  const toggleMulti = useCallback(
    (key: string, value: string, checked: boolean) => {
      const next = new URLSearchParams(params);
      const current = next.getAll(key);
      next.delete(key);
      const updated = checked
        ? [...current, value]
        : current.filter((entry) => entry !== value);
      for (const entry of updated) next.append(key, entry);
      commit(next);
    },
    [params, commit],
  );

  // Which filters the user has chosen to hide (persisted). Starts empty so SSR
  // and the first client render agree, then loads on mount.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FILTER_PREFS_KEY);
      if (raw) setHidden(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore unreadable prefs
    }
  }, []);
  const toggleHidden = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(
          FILTER_PREFS_KEY,
          JSON.stringify([...next]),
        );
      } catch {
        // ignore unwritable prefs
      }
      return next;
    });
  }, []);

  const selectedAreas = params.getAll("area");
  const selectedSources = params.getAll("source");
  const sort = params.get("sort") ?? "newest";

  // A filter is hideable; an active one always shows so it can't be lost.
  const HIDEABLE = [
    { key: "maxPrice", label: "Max price", active: !!params.get("maxPrice") },
    {
      key: "minUsable",
      label: "Min usable m²",
      active: !!params.get("minUsable"),
    },
    { key: "minLand", label: "Min land m²", active: !!params.get("minLand") },
    {
      key: "maxPrague",
      label: "Max km to Prague",
      active: !!params.get("maxPrague"),
    },
    { key: "areas", label: "Areas", active: selectedAreas.length > 0 },
    { key: "source", label: "Source", active: selectedSources.length > 0 },
    {
      key: "goodDeals",
      label: "Good deals",
      active: params.get("goodDeals") === "1",
    },
    {
      key: "nearTrain",
      label: "Near train",
      active: params.get("nearTrain") === "1",
    },
    { key: "fresh", label: "New", active: params.get("fresh") === "1" },
    {
      key: "sinceVisit",
      label: "New since last visit",
      active: params.get("sinceVisit") === "1",
    },
  ];
  const show = (key: string) =>
    !hidden.has(key) || (HIDEABLE.find((f) => f.key === key)?.active ?? false);

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b bg-background/80 px-4 py-2.5 backdrop-blur *:shrink-0 lg:flex-wrap lg:overflow-visible">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            title="Show or hide filters"
          >
            <RiFilter3Line className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
            Show filters
          </p>
          <div className="space-y-1">
            {HIDEABLE.map((filter) => (
              <Label
                key={filter.key}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm font-normal hover:bg-muted"
              >
                <Checkbox
                  checked={!hidden.has(filter.key) || filter.active}
                  disabled={filter.active}
                  onCheckedChange={() => toggleHidden(filter.key)}
                />
                <span className="flex-1 truncate">{filter.label}</span>
              </Label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Select value={sort} onValueChange={(value) => setParam("sort", value)}>
        <SelectTrigger className="h-8 w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.value === "distance" && !config?.anchor}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {show("maxPrice") && (
        <CommitInput
          placeholder="Max price (Kč)"
          defaultValue={params.get("maxPrice") ?? ""}
          onCommit={(value) => setParam("maxPrice", value)}
          className="w-[130px]"
        />
      )}
      {show("minUsable") && (
        <CommitInput
          placeholder="Min usable m²"
          defaultValue={params.get("minUsable") ?? ""}
          onCommit={(value) => setParam("minUsable", value)}
          className="w-[120px]"
        />
      )}
      {show("minLand") && (
        <CommitInput
          placeholder="Min land m²"
          defaultValue={params.get("minLand") ?? ""}
          onCommit={(value) => setParam("minLand", value)}
          className="w-[110px]"
        />
      )}
      {show("maxPrague") && (
        <CommitInput
          placeholder="Max km to Prague"
          defaultValue={params.get("maxPrague") ?? ""}
          onCommit={(value) => setParam("maxPrague", value)}
          className="w-[140px]"
        />
      )}

      {show("areas") && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Areas
              {selectedAreas.length > 0 && (
                <Badge variant="secondary">{selectedAreas.length}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <ScrollArea className="h-72">
              <div className="space-y-1 p-2">
                {config?.areas.map((area) => (
                  <Label
                    key={area.code}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm font-normal hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedAreas.includes(area.code)}
                      onCheckedChange={(checked) =>
                        toggleMulti("area", area.code, checked === true)
                      }
                    />
                    <span className="flex-1 truncate">{area.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {area.count}
                    </span>
                  </Label>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      {show("source") && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Source
              {selectedSources.length > 0 && (
                <Badge variant="secondary">{selectedSources.length}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start">
            <div className="space-y-1">
              {SOURCES.map((source) => (
                <Label
                  key={source}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm font-normal hover:bg-muted"
                >
                  <Checkbox
                    checked={selectedSources.includes(source)}
                    onCheckedChange={(checked) =>
                      toggleMulti("source", source, checked === true)
                    }
                  />
                  <span className="flex-1 truncate">
                    {formatSource(source)}
                  </span>
                </Label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {show("goodDeals") && (
        <Label className="flex items-center gap-1.5 text-sm font-normal">
          <Switch
            checked={params.get("goodDeals") === "1"}
            onCheckedChange={(checked) =>
              setParam("goodDeals", checked ? "1" : null)
            }
          />
          Good deals
        </Label>
      )}
      {show("nearTrain") && (
        <Label className="flex items-center gap-1.5 text-sm font-normal">
          <Switch
            checked={params.get("nearTrain") === "1"}
            onCheckedChange={(checked) =>
              setParam("nearTrain", checked ? "1" : null)
            }
          />
          Near train
        </Label>
      )}
      {show("fresh") && (
        <Label className="flex items-center gap-1.5 text-sm font-normal">
          <Switch
            checked={params.get("fresh") === "1"}
            onCheckedChange={(checked) =>
              setParam("fresh", checked ? "1" : null)
            }
          />
          New {config ? `(${config.feedWindowHours}h)` : ""}
        </Label>
      )}
      {show("sinceVisit") && (
        <Label className="flex items-center gap-1.5 text-sm font-normal">
          <Switch
            checked={params.get("sinceVisit") === "1"}
            onCheckedChange={(checked) =>
              setParam("sinceVisit", checked ? "1" : null)
            }
          />
          Since last visit
        </Label>
      )}

      {params.toString().length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => commit(new URLSearchParams())}
        >
          <RiCloseLine className="size-4" /> Reset
        </Button>
      )}
    </div>
  );
}

function CommitInput({
  placeholder,
  defaultValue,
  onCommit,
  className,
}: {
  placeholder: string;
  defaultValue: string;
  onCommit: (value: string) => void;
  className?: string;
}) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      placeholder={placeholder}
      defaultValue={defaultValue}
      className={`h-8 ${className ?? ""}`}
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
    />
  );
}
