"use client";

import {
  RiHeart3Fill,
  RiHome4Line,
  RiKeyboardLine,
  RiListUnordered,
  RiMap2Line,
  RiRefreshLine,
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

// Stable empty reference so a not-yet-loaded by-id query doesn't churn the map.
const NO_CARDS: ClusterCard[] = [];

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

/** `/api/clusters?id=…` — fetch a set of clusters by id, ignoring the filters. */
function byIdUrl(ids: number[]): string {
  const params = new URLSearchParams();
  for (const id of ids) params.append("id", String(id));
  return `/api/clusters?${params.toString()}`;
}

/**
 * Order cards newest-added-first. A card's rank is its position in the triage
 * set's insertion order (JS Sets preserve it — newest additions land last),
 * reversed so the latest like / seen leads. Also drops any card no longer in
 * the set, so an optimistic un-like / restore disappears before the refetch.
 */
function byRecency(
  cards: ClusterCard[],
  order: ReadonlySet<number>,
): ClusterCard[] {
  const rank = new Map<number, number>();
  let index = 0;
  for (const id of order) rank.set(id, index++);
  return cards
    .filter((card) => rank.has(card.clusterId))
    .sort(
      (a, b) => (rank.get(b.clusterId) ?? 0) - (rank.get(a.clusterId) ?? 0),
    );
}

export function HomeScreen({ authEnabled }: { authEnabled: boolean }) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [view, setView] = useState<TriageView>("all");
  const [helpOpen, setHelpOpen] = useState(false);
  // Mobile shows one pane at a time (toggled below); desktop shows both split.
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const isDesktop = useIsDesktop();

  const { liked, hidden } = useTriage();
  // Counts come straight from the triage store, so they reflect the whole
  // collection regardless of what the filter bar currently matches.
  const likedCount = liked.size;
  const hiddenCount = hidden.size;

  const likedIds = useMemo(() => [...liked].sort((a, b) => a - b), [liked]);
  const hiddenIds = useMemo(() => [...hidden].sort((a, b) => a - b), [hidden]);

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

  // The liked + seen collections are fetched by id, so they survive any filter.
  const likedQuery = useQuery({
    queryKey: ["clusters", "by-id", likedIds.join(",")],
    queryFn: () => fetchJson<{ clusters: ClusterCard[] }>(byIdUrl(likedIds)),
    select: (data) => data.clusters,
    enabled: view === "liked" && likedIds.length > 0,
  });

  const seenQuery = useQuery({
    queryKey: ["clusters", "by-id", hiddenIds.join(",")],
    queryFn: () => fetchJson<{ clusters: ClusterCard[] }>(byIdUrl(hiddenIds)),
    select: (data) => data.clusters,
    enabled: view === "hidden" && hiddenIds.length > 0,
  });

  const anchor = config.data?.anchor ?? null;
  const cards = clusters.data ?? NO_CARDS;

  // The live feed excludes everything already triaged — liked and seen each
  // get their own tab.
  const feedCards = useMemo(
    () =>
      cards.filter(
        (card) => !liked.has(card.clusterId) && !hidden.has(card.clusterId),
      ),
    [cards, liked, hidden],
  );
  // Order each collection newest-added-first (and re-filter through the live
  // set so an optimistic un-like / restore drops a card before the refetch).
  const likedCards = useMemo(
    () => byRecency(likedQuery.data ?? NO_CARDS, liked),
    [likedQuery.data, liked],
  );
  const seenCards = useMemo(
    () => byRecency(seenQuery.data ?? NO_CARDS, hidden),
    [seenQuery.data, hidden],
  );

  const visible =
    view === "liked" ? likedCards : view === "hidden" ? seenCards : feedCards;
  const listLoading =
    view === "liked"
      ? likedQuery.isLoading
      : view === "hidden"
        ? seenQuery.isLoading
        : clusters.isLoading;
  const listError =
    view === "liked"
      ? likedQuery.isError
      : view === "hidden"
        ? seenQuery.isError
        : clusters.isError;

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
    onLike: (id) => triageStore.toggleLike(id),
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
            value="liked"
            className="h-8 gap-1 text-xs"
            disabled={likedCount === 0}
          >
            <RiHeart3Fill className="size-3.5 text-rose-500" />
            {likedCount}
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

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 max-lg:pb-20">
        {listLoading ? (
          Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={`skeleton-${index}`} className="h-40 w-full" />
          ))
        ) : listError ? (
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
              isLiked={liked.has(card.clusterId)}
              isHidden={hidden.has(card.clusterId)}
              isExpanded={card.clusterId === expandedId}
              onSelect={selectAndScroll}
              onToggleExpand={handleToggleExpand}
              onToggleLike={(id) => triageStore.toggleLike(id)}
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
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <RiHome4Line className="size-5 text-primary" />
          <span className="font-mono font-semibold tracking-tight">
            home-hunter
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-mono text-muted-foreground">
            {listLoading ? "loading…" : `${visible.length} listings`}
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
            className="hidden size-8 lg:inline-flex"
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
        <div className="relative min-h-0 flex-1">
          {/* Both panes stay mounted at full size — `invisible` (not `hidden`)
              keeps the map's container sized so it never re-renders at 0×0. */}
          <div
            className={cn(
              "absolute inset-0",
              mobileView === "map" && "invisible",
            )}
          >
            {feedColumn}
          </div>
          <div
            className={cn(
              "absolute inset-0",
              mobileView === "list" && "invisible",
            )}
          >
            {mapPanel}
          </div>

          <ToggleGroup
            type="single"
            variant="outline"
            value={mobileView}
            onValueChange={(next) =>
              next && setMobileView(next as "list" | "map")
            }
            className="-translate-x-1/2 absolute bottom-4 left-1/2 z-10 rounded-full border bg-background/95 shadow-lg backdrop-blur"
          >
            <ToggleGroupItem
              value="list"
              className="h-9 gap-1.5 rounded-full px-4"
            >
              <RiListUnordered className="size-4" /> List
            </ToggleGroupItem>
            <ToggleGroupItem
              value="map"
              className="h-9 gap-1.5 rounded-full px-4"
            >
              <RiMap2Line className="size-4" /> Map
            </ToggleGroupItem>
          </ToggleGroup>
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
  if (view === "liked") {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
        <RiHeart3Fill className="size-6 text-rose-500" />
        <p className="text-sm">
          Nothing liked yet. Hit <kbd>s</kbd> on a listing — or the heart — to
          keep it here.
        </p>
      </div>
    );
  }
  if (view === "hidden") {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
        <RiHome4Line className="size-6" />
        <p className="text-sm">
          Nothing marked seen yet. Press <kbd>x</kbd> on a listing to dismiss
          it.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
      <RiHome4Line className="size-6" />
      <p className="text-sm">
        {hasCards
          ? "Everything here is triaged. Check Liked or Seen, or loosen the filters."
          : "No listings match. Loosen the filters, or run "}
        {!hasCards && (
          <code className="rounded bg-muted px-1">npm run pipeline</code>
        )}
        {!hasCards && "."}
      </p>
    </div>
  );
}
