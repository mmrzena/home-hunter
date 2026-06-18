"use client";

import { RiCloseLine, RiFilter3Line } from "@remixicon/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

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

  const toggleArea = useCallback(
    (code: string, checked: boolean) => {
      const next = new URLSearchParams(params);
      const current = next.getAll("area");
      next.delete("area");
      const updated = checked
        ? [...current, code]
        : current.filter((value) => value !== code);
      for (const value of updated) next.append("area", value);
      commit(next);
    },
    [params, commit],
  );

  const selectedAreas = params.getAll("area");
  const sort = params.get("sort") ?? "newest";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-background/80 px-4 py-2.5 backdrop-blur">
      <RiFilter3Line className="size-4 text-muted-foreground" />

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

      <CommitInput
        placeholder="Max price (Kč)"
        defaultValue={params.get("maxPrice") ?? ""}
        onCommit={(value) => setParam("maxPrice", value)}
        className="w-[130px]"
      />
      <CommitInput
        placeholder="Min usable m²"
        defaultValue={params.get("minUsable") ?? ""}
        onCommit={(value) => setParam("minUsable", value)}
        className="w-[120px]"
      />
      <CommitInput
        placeholder="Min land m²"
        defaultValue={params.get("minLand") ?? ""}
        onCommit={(value) => setParam("minLand", value)}
        className="w-[110px]"
      />
      <CommitInput
        placeholder="Max km to Prague"
        defaultValue={params.get("maxPrague") ?? ""}
        onCommit={(value) => setParam("maxPrague", value)}
        className="w-[140px]"
      />

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
                      toggleArea(area.code, checked === true)
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

      <Label className="flex items-center gap-1.5 text-sm font-normal">
        <Switch
          checked={params.get("goodDeals") === "1"}
          onCheckedChange={(checked) =>
            setParam("goodDeals", checked ? "1" : null)
          }
        />
        Good deals
      </Label>
      <Label className="flex items-center gap-1.5 text-sm font-normal">
        <Switch
          checked={params.get("nearTrain") === "1"}
          onCheckedChange={(checked) =>
            setParam("nearTrain", checked ? "1" : null)
          }
        />
        Near train
      </Label>
      <Label className="flex items-center gap-1.5 text-sm font-normal">
        <Switch
          checked={params.get("fresh") === "1"}
          onCheckedChange={(checked) => setParam("fresh", checked ? "1" : null)}
        />
        New {config ? `(${config.feedWindowHours}h)` : ""}
      </Label>

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
