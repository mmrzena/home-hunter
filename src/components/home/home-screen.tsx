"use client";

import {
  RiHome4Line,
  RiKeyboardLine,
  RiRefreshLine,
  RiStarFill,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TONE_DOT, type Tone } from "@/lib/listing-status";
import { type TriageView, triageStore, useTriage } from "@/lib/triage-store";
import type { AppConfig, ClusterCard } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AuthMenu } from "./auth-menu";
import { ClusterCard as Card } from "./cluster-card";
import { FilterBar } from "./filter-bar";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { TriageSync } from "./triage-sync";
import { useIsDesktop } from "./use-is-desktop";
import { useKeyboardNav } from "./use-keyboard-nav";

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

export function HomeScreen({ authEnabled }: { authEnabled: boolean }) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [view, setView] = useState<TriageView>("all");
  const [helpOpen, setHelpOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const { shortlisted, hidden } = useTriage();

  const selectAndScroll = useCallback((id: number) => {
    setSelectedId(id);
    requestAnimationFrame(() => {
      document
        .getElementById(`cluster-card-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  // The chevron (and keyboard "o") toggle the inline detail. A plain click on
  // the card body or a map marker only selects — it never auto-expands.
  const handleToggleExpand = useCallback(
    (id: number) => {
      selectAndScroll(id);
      setExpandedId((current) => (current === id ? null : id));
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

  const shortlistCount = cards.filter((card) =>
    shortlisted.has(card.clusterId),
  ).length;
  const hiddenCount = cards.filter((card) => hidden.has(card.clusterId)).length;

  // Memoized so its identity is stable across re-renders — the map keys marker
  // rebuilds and pans off this array, and a fresh array each render made the
  // map re-fit + re-fly on every click (the "jumps two or three times" bug).
  const visible = useMemo(
    () =>
      cards.filter((card) => {
        if (view === "shortlist") return shortlisted.has(card.clusterId);
        if (view === "hidden") return hidden.has(card.clusterId);
        return !hidden.has(card.clusterId);
      }),
    [cards, view, shortlisted, hidden],
  );

  const deals = visible.filter((card) => card.isGoodDeal).length;
  const cautions = visible.filter(
    (card) => card.scamScore != null && card.scamScore >= 30,
  ).length;
  const fresh = visible.filter((card) => card.isNew).length;

  useKeyboardNav({
    ids: visible.map((card) => card.clusterId),
    selectedId,
    onSelect: selectAndScroll,
    onOpenDetail: handleToggleExpand,
    onShortlist: (id) => triageStore.toggleShortlist(id),
    onHide: (id) => triageStore.hide(id),
    onRefresh: () => clusters.refetch(),
    onClear: () => {
      if (expandedId != null) setExpandedId(null);
      else setSelectedId(null);
    },
    onToggleHelp: () => setHelpOpen((open) => !open),
  });

  const handleToggleHide = useCallback(
    (id: number) => {
      if (hidden.has(id)) triageStore.unhide(id);
      else triageStore.hide(id);
    },
    [hidden],
  );

  const feedColumn = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={view}
          onValueChange={(next) => next && setView(next as TriageView)}
        >
          <ToggleGroupItem value="all" className="h-8 text-xs">
            All
          </ToggleGroupItem>
          <ToggleGroupItem
            value="shortlist"
            className="h-8 gap-1 text-xs"
            disabled={shortlistCount === 0}
          >
            <RiStarFill className="size-3.5 text-amber-500" />
            {shortlistCount}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="hidden"
            className="h-8 text-xs"
            disabled={hiddenCount === 0}
          >
            Seen {hiddenCount > 0 ? hiddenCount : ""}
          </ToggleGroupItem>
        </ToggleGroup>
        {view === "hidden" && hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 text-xs"
            onClick={() => triageStore.clearHidden()}
          >
            Restore all
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {clusters.isLoading ? (
          Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={`skeleton-${index}`} className="h-40 w-full" />
          ))
        ) : clusters.isError ? (
          <p className="p-4 text-sm text-destructive">
            Couldn't load listings. Is the worker pipeline run and the DB up?
          </p>
        ) : visible.length === 0 ? (
          <EmptyState view={view} hasCards={cards.length > 0} />
        ) : (
          visible.map((card) => (
            <Card
              key={card.clusterId}
              card={card}
              anchorLabel={anchor?.label ?? null}
              isSelected={card.clusterId === selectedId}
              isShortlisted={shortlisted.has(card.clusterId)}
              isHidden={hidden.has(card.clusterId)}
              isExpanded={card.clusterId === expandedId}
              onSelect={selectAndScroll}
              onToggleExpand={handleToggleExpand}
              onToggleShortlist={(id) => triageStore.toggleShortlist(id)}
              onToggleHide={handleToggleHide}
              onHover={setHoveredId}
            />
          ))
        )}
      </div>
    </div>
  );

  const mapPanel = (
    <div className="relative size-full">
      <ListingMap
        clusters={visible}
        selectedId={selectedId}
        hoveredId={hoveredId}
        shortlisted={shortlisted}
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
  );

  return (
    <div className="flex h-screen flex-col">
      {authEnabled && <TriageSync />}
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <RiHome4Line className="size-5 text-primary" />
          <span className="font-mono font-semibold tracking-tight">
            home-hunter
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-mono text-muted-foreground">
            {clusters.isLoading ? "loading…" : `${visible.length} listings`}
          </span>
          {deals > 0 && (
            <span className="rounded-full bg-green-600/10 px-2 py-0.5 font-mono text-xs font-medium text-green-700 dark:text-green-400">
              {deals} deals
            </span>
          )}
          {fresh > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground">
              {fresh} new
            </span>
          )}
          {cautions > 0 && (
            <span className="rounded-full bg-red-600/10 px-2 py-0.5 font-mono text-xs font-medium text-red-700 dark:text-red-400">
              {cautions} caution
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setHelpOpen(true)}
            title="Keyboard shortcuts (?)"
          >
            <RiKeyboardLine className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => clusters.refetch()}
            title="Refresh (r)"
          >
            <RiRefreshLine
              className={cn("size-4", clusters.isFetching && "animate-spin")}
            />
          </Button>
          <ThemeToggle />
          {authEnabled && <AuthMenu />}
        </div>
      </header>

      <FilterBar config={config.data} />

      {isDesktop ? (
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          <ResizablePanel
            defaultSize="37%"
            minSize="24%"
            maxSize="62%"
            className="min-h-0 overflow-hidden"
          >
            {feedColumn}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            defaultSize="63%"
            minSize="30%"
            className="min-h-0 overflow-hidden"
          >
            {mapPanel}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="h-[38vh] shrink-0">{mapPanel}</div>
          <div className="min-h-0 flex-1">{feedColumn}</div>
        </div>
      )}

      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

function EmptyState({
  view,
  hasCards,
}: {
  view: TriageView;
  hasCards: boolean;
}) {
  if (view === "shortlist") {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
        <RiStarFill className="size-6 text-amber-500" />
        <p className="text-sm">
          No shortlisted listings yet. Hit <kbd>s</kbd> on a listing — or the
          star — to keep it here.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
      <RiHome4Line className="size-6" />
      <p className="text-sm">
        {hasCards
          ? "Everything here is hidden. Switch to All to bring listings back."
          : "No listings match. Loosen the filters, or run "}
        {!hasCards && (
          <code className="rounded bg-muted px-1">npm run pipeline</code>
        )}
        {!hasCards && "."}
      </p>
    </div>
  );
}
