"use client";

import { RiHome4Line, RiRefreshLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TONE_DOT, type Tone } from "@/lib/listing-status";
import type { AppConfig, ClusterCard } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ClusterCard as Card } from "./cluster-card";
import { ClusterDetailSheet } from "./cluster-detail-sheet";
import { FilterBar } from "./filter-bar";

const ListingMap = dynamic(
  () => import("./listing-map").then((module) => module.ListingMap),
  {
    ssr: false,
    loading: () => <div className="size-full animate-pulse bg-muted" />,
  },
);

const LEGEND: Array<{ tone: Tone; label: string }> = [
  { tone: "deal", label: "Good deal" },
  { tone: "fair", label: "Fair" },
  { tone: "overpriced", label: "Overpriced" },
  { tone: "caution", label: "Caution" },
];

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export function HomeScreen() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const selectAndScroll = useCallback((id: number) => {
    setSelectedId(id);
    requestAnimationFrame(() => {
      document
        .getElementById(`cluster-card-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  // Map marker → light select (popup peek). Feed card → open full detail.
  const handleOpenDetail = useCallback(
    (id: number) => {
      selectAndScroll(id);
      setDetailId(id);
    },
    [selectAndScroll],
  );

  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => fetchJson<AppConfig>("/api/config"),
    staleTime: 5 * 60_000,
  });

  const clusters = useQuery({
    queryKey: ["clusters", query],
    queryFn: () =>
      fetchJson<{ clusters: ClusterCard[] }>(`/api/clusters?${query}`),
    select: (data) => data.clusters,
  });

  const anchor = config.data?.anchor ?? null;
  const cards = clusters.data ?? [];
  const detailCard = cards.find((card) => card.clusterId === detailId) ?? null;

  const deals = cards.filter((card) => card.isGoodDeal).length;
  const cautions = cards.filter(
    (card) => card.scamScore != null && card.scamScore >= 30,
  ).length;
  const fresh = cards.filter((card) => card.isNew).length;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <RiHome4Line className="size-5 text-primary" />
          <span className="font-semibold">home-hunter</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            {clusters.isLoading ? "loading…" : `${cards.length} listings`}
          </span>
          {deals > 0 && (
            <span className="text-green-700 dark:text-green-400">
              {deals} deals
            </span>
          )}
          {fresh > 0 && <span>{fresh} new</span>}
          {cautions > 0 && (
            <span className="text-red-700 dark:text-red-400">
              {cautions} caution
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => clusters.refetch()}
            title="Refresh"
          >
            <RiRefreshLine
              className={cn("size-4", clusters.isFetching && "animate-spin")}
            />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <FilterBar config={config.data} />

      <div className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
        <div className="flex w-full flex-col gap-2 overflow-y-auto p-3 lg:w-[480px]">
          {clusters.isLoading ? (
            Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={`skeleton-${index}`} className="h-40 w-full" />
            ))
          ) : clusters.isError ? (
            <p className="p-4 text-sm text-destructive">
              Couldn't load listings. Is the worker pipeline run and the DB up?
            </p>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
              <RiHome4Line className="size-6" />
              <p className="text-sm">
                No listings match. Loosen the filters, or run{" "}
                <code className="rounded bg-muted px-1">npm run pipeline</code>.
              </p>
            </div>
          ) : (
            cards.map((card) => (
              <Card
                key={card.clusterId}
                card={card}
                anchorLabel={anchor?.label ?? null}
                isSelected={card.clusterId === selectedId}
                onSelect={handleOpenDetail}
              />
            ))
          )}
        </div>

        <div className="relative h-[38vh] w-full lg:h-auto lg:flex-1">
          <ListingMap
            clusters={cards}
            selectedId={selectedId}
            onSelect={selectAndScroll}
            anchor={anchor}
          />
          <div className="pointer-events-none absolute bottom-2 left-2 flex flex-col gap-1 rounded-md border bg-background/90 p-2 text-xs shadow-sm backdrop-blur">
            {LEGEND.map((item) => (
              <span key={item.tone} className="flex items-center gap-1.5">
                <span
                  className={cn("size-2.5 rounded-full", TONE_DOT[item.tone])}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ClusterDetailSheet
        card={detailCard}
        open={detailId != null}
        onOpenChange={(next) => {
          if (!next) setDetailId(null);
        }}
        anchorLabel={anchor?.label ?? null}
      />
    </div>
  );
}
