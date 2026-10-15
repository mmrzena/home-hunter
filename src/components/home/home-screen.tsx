"use client";

import {
  RiCheckDoubleLine,
  RiCloseLine,
  RiHeart3Fill,
  RiHome4Line,
  RiKeyboardLine,
  RiListUnordered,
  RiMap2Line,
  RiRefreshLine,
} from "@remixicon/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fetchJson } from "@/lib/fetch-json";
import { isInBounds, type MapBounds } from "@/lib/map-bounds";
import { type TriageView, triageStore, useTriage } from "@/lib/triage-store";
import type { AppConfig, ClusterCard } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ClusterCard as Card } from "./cluster-card";
import { FilterBar } from "./filter-bar";
import { FilterPrefsSync } from "./filter-prefs-sync";
import { MapDetailPanel } from "./map-detail-panel";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { TriageSync } from "./triage-sync";
import { useKeyboardNav } from "./use-keyboard-nav";

const ListingMap = dynamic(
  () => import("./listing-map").then((module) => module.ListingMap),
  {
    ssr: false,
    loading: () => <div className="size-full animate-pulse bg-muted" />,
  },
);

const LEGEND = [
  {
    label: "Good price",
    swatch: <span className="size-2.5 rounded-full bg-green-600" />,
  },
  {
    label: "Other",
    swatch: <span className="size-2.5 rounded-full bg-slate-400" />,
  },
  {
    label: "Liked",
    swatch: <RiHeart3Fill className="-mx-px size-3 text-rose-500" />,
  },
  {
    label: "Seen",
    swatch: (
      <span className="size-2.5 rounded-full border-2 border-slate-600" />
    ),
  },
];

// Stable empty reference so a not-yet-loaded by-id query doesn't churn the map.
const NO_CARDS: ClusterCard[] = [];

/**
 * Bring a feed card into view. Two passes: off-screen cards are only estimated
 * (`content-visibility: auto`), so the first, instant scroll lands near the card
 * and lets its neighbours lay out for real; the second settles on it.
 */
function scrollCardIntoView(id: number) {
  const card = () => document.getElementById(`cluster-card-${id}`);
  requestAnimationFrame(() => {
    card()?.scrollIntoView({ block: "nearest" });
    requestAnimationFrame(() =>
      card()?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  });
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
  // Houses you've un-liked this session — a filter-agnostic safety net so an
  // off-filter house you remove from Liked doesn't vanish without a trace.
  // Session-only: cleared on reload, when the house is simply untriaged again.
  const [unlikedCards, setUnlikedCards] = useState<Map<number, ClusterCard>>(
    () => new Map(),
  );
  const [helpOpen, setHelpOpen] = useState(false);
  // The map is the screen; the feed is an opt-in column beside it (desktop) or
  // over it (phone), off by default.
  const [isListVisible, setIsListVisible] = useState(false);
  // "Only in view": the feed follows the map viewport. The markers keep
  // showing the whole set so panning can bring houses back.
  const [isOnlyInView, setIsOnlyInView] = useState(false);
  // The house in the map's detail panel — captured, not looked up by id, so
  // liking or hiding it (which drops it out of the current tab) doesn't yank
  // the panel.
  const [tappedCard, setTappedCard] = useState<ClusterCard | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  const { liked, hidden } = useTriage();
  // Liked is the one filter-agnostic collection (always visible), so its count
  // is the whole set. Seen now respects the filter, so its count is derived
  // from the filtered feed below.
  const likedCount = liked.size;

  const likedIds = useMemo(() => [...liked].sort((a, b) => a - b), [liked]);

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

  // Liked is filter-agnostic, so it's fetched by id (survives any filter).
  // keepPreviousData holds the list on screen while the id set changes (e.g.
  // after a like/restore), so toggling one card never flashes skeletons — the
  // optimistic `byRecency` filter drops the affected card immediately.
  const likedQuery = useQuery({
    queryKey: ["clusters", "by-id", likedIds.join(",")],
    queryFn: () => fetchJson<{ clusters: ClusterCard[] }>(byIdUrl(likedIds)),
    select: (data) => data.clusters,
    enabled: likedIds.length > 0,
    placeholderData: keepPreviousData,
  });

  const anchor = config.data?.anchor ?? null;
  const cards = clusters.data ?? NO_CARDS;

  // The All feed respects the filter bar: the filtered server feed minus
  // anything triaged. Un-liking returns a house to the pool — it reappears here
  // only if it still matches the filter, otherwise it simply drops out of view.
  const feedCards = useMemo(
    () =>
      cards.filter(
        (card) => !liked.has(card.clusterId) && !hidden.has(card.clusterId),
      ),
    [cards, liked, hidden],
  );
  // Liked: newest-liked-first, re-filtered through the live set so an optimistic
  // un-like drops a card before the refetch. Seen: the filtered feed intersected
  // with the hidden set (newest-hidden-first) — it respects the filter bar now.
  // A by-id pool for looking up a card when you un-like it (it may be off-filter
  // and so absent from the feed query). Liked cards live in likedQuery, feed
  // cards in `cards`; one of those holds any card whose heart you can click.
  const cardsById = useMemo(() => {
    const map = new Map<number, ClusterCard>();
    for (const card of cards) map.set(card.clusterId, card);
    for (const card of likedQuery.data ?? NO_CARDS)
      map.set(card.clusterId, card);
    return map;
  }, [cards, likedQuery.data]);

  // Built from the whole pool, not just likedQuery, so a house liked from the
  // feed is in the Liked list immediately rather than after its by-id refetch.
  const likedCards = useMemo(
    () => byRecency([...cardsById.values()], liked),
    [cardsById, liked],
  );
  const seenCards = useMemo(() => byRecency(cards, hidden), [cards, hidden]);

  // Stable (no deps) so the memoised feed cards keep their handler identity.
  const selectAndScroll = useCallback((id: number) => {
    setSelectedId(id);
    scrollCardIntoView(id);
  }, []);

  // Select + open the map's detail panel. Any house a pin can stand for is in
  // the pool or this session's un-likes.
  const selectInPanel = (id: number) => {
    selectAndScroll(id);
    setTappedCard(cardsById.get(id) ?? unlikedCards.get(id) ?? null);
  };

  // The chevron (and keyboard "o") toggle the gallery + sources. A plain click
  // on the card body or a map marker only selects — it never auto-expands.
  const handleToggleExpand = useCallback(
    (id: number) => {
      selectAndScroll(id);
      setExpandedId((current) => (current === id ? null : id));
    },
    [selectAndScroll],
  );

  // This session's un-likes, newest first, minus any since re-liked or marked
  // seen. Filter-agnostic by construction — the cards are captured, not queried.
  const unlikedList = useMemo(() => {
    const result: ClusterCard[] = [];
    for (const card of unlikedCards.values()) {
      if (!liked.has(card.clusterId) && !hidden.has(card.clusterId))
        result.push(card);
    }
    return result.reverse();
  }, [unlikedCards, liked, hidden]);

  // The Unliked tab vanishes when its list empties; coerce a stale selection
  // back to All so the toggle never points at a missing tab (no effect needed).
  const unlikedCount = unlikedList.length;
  const effectiveView = view === "unliked" && unlikedCount === 0 ? "all" : view;

  // Liked is the only by-id query; All / Seen / Unliked all read the feed query.
  const activeQuery = effectiveView === "liked" ? likedQuery : clusters;
  const visible =
    effectiveView === "liked"
      ? likedCards
      : effectiveView === "hidden"
        ? seenCards
        : effectiveView === "unliked"
          ? unlikedList
          : feedCards;
  // What the list (and keyboard nav) shows: the tab's cards, narrowed to the
  // map viewport when "only in view" is on. Without bounds yet, everything.
  const listed =
    isOnlyInView && mapBounds
      ? visible.filter((card) => isInBounds(card, mapBounds))
      : visible;
  const inViewCount = mapBounds
    ? visible.filter((card) => isInBounds(card, mapBounds)).length
    : visible.length;

  // The All + Seen tab counts (filter-scoped) and the header total. The total is
  // the sum of the three persistent tabs, so it stays put as you switch them
  // (liked is the whole collection; all + seen are the filtered feed).
  const allCount = feedCards.length;
  const hiddenCount = seenCards.length;
  const totalCount = allCount + likedCount + hiddenCount;

  // Toggle like, capturing the card into the session Unliked set on remove
  // (and dropping it on re-like) so an off-filter house stays recoverable.
  const handleToggleLike = useCallback(
    (id: number) => {
      const wasLiked = liked.has(id);
      triageStore.toggleLike(id);
      setUnlikedCards((prev) => {
        if (!wasLiked && !prev.has(id)) return prev;
        const next = new Map(prev);
        if (wasLiked) {
          const card = cardsById.get(id);
          if (card) next.set(id, card);
        } else {
          next.delete(id);
        }
        return next;
      });
    },
    [liked, cardsById],
  );

  // With the feed hidden, the panel is the only place to see what j/k land on.
  useKeyboardNav({
    ids: listed.map((card) => card.clusterId),
    selectedId,
    onSelect: isListVisible ? selectAndScroll : selectInPanel,
    onOpenDetail: handleToggleExpand,
    onLike: handleToggleLike,
    onHide: (id) => triageStore.hide(id),
    onRefresh: () => clusters.refetch(),
    onClear: () => {
      if (expandedId != null) setExpandedId(null);
      else setSelectedId(null);
    },
    onToggleHelp: () => setHelpOpen((open) => !open),
    onToggleList: () => setIsListVisible((shown) => !shown),
  });

  // The detail panel follows the selection (Esc clears both). A house you
  // triaged from it stays up; one that a filter change dropped from the map
  // doesn't.
  const isListedOrTriaged = (id: number) =>
    liked.has(id) ||
    hidden.has(id) ||
    visible.some((card) => card.clusterId === id);
  const detailCard =
    tappedCard &&
    tappedCard.clusterId === selectedId &&
    isListedOrTriaged(tappedCard.clusterId)
      ? tappedCard
      : null;

  // The All map shows every house matching the filter, triaged or not (the
  // marker shape tells them apart), plus every liked house — Liked ignores the
  // filter everywhere else, so it does here too.
  const mapCards = useMemo(
    () =>
      effectiveView === "all"
        ? [...cards.filter((card) => !liked.has(card.clusterId)), ...likedCards]
        : visible,
    [effectiveView, cards, liked, likedCards, visible],
  );

  // Also the map's background click, which mostly lands with nothing open.
  const handleCloseDetail = () => {
    if (tappedCard === null && selectedId === null) return;
    setTappedCard(null);
    setSelectedId(null);
  };

  // Lands on the tab that actually lists the house — after a like / seen from
  // the panel it has left the current one.
  const handleOpenInList = (card: ClusterCard) => {
    const id = card.clusterId;
    if (!visible.some((entry) => entry.clusterId === id))
      setView(liked.has(id) ? "liked" : hidden.has(id) ? "hidden" : "all");
    if (mapBounds && !isInBounds(card, mapBounds)) setIsOnlyInView(false);
    setTappedCard(null);
    setIsListVisible(true);
    setExpandedId(id);
    selectAndScroll(id);
  };

  const handleMarkAllSeen = () => {
    const ids = listed.map((card) => card.clusterId);
    triageStore.hideMany(ids);
    toast(`Marked ${ids.length} as seen`, {
      action: { label: "Undo", onClick: () => triageStore.unhideMany(ids) },
    });
  };

  const handleToggleHide = useCallback(
    (id: number) => {
      if (hidden.has(id)) triageStore.unhide(id);
      else triageStore.hide(id);
    },
    [hidden],
  );

  // Always on screen, so you never scroll a long feed to reach these.
  const triageBar = (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b px-3 py-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={effectiveView}
        onValueChange={(next) => next && setView(next as TriageView)}
      >
        <ToggleGroupItem value="all" className="h-8 text-xs">
          All {allCount}
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
        {unlikedCount > 0 && (
          <ToggleGroupItem value="unliked" className="h-8 text-xs">
            Unliked {unlikedCount}
          </ToggleGroupItem>
        )}
      </ToggleGroup>
      {isOnlyInView && (
        <Button
          variant="secondary"
          size="sm"
          className="h-8 shrink-0 gap-1 text-xs"
          title="Showing only houses inside the map view"
          onClick={() => setIsOnlyInView(false)}
        >
          <RiMap2Line className="size-3.5" /> {listed.length} in view
          <RiCloseLine className="size-3.5" />
        </Button>
      )}
      {effectiveView === "hidden" && hiddenCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-8 shrink-0 text-xs"
          onClick={() => triageStore.clearHidden()}
        >
          Restore all
        </Button>
      )}
      {effectiveView === "all" && listed.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-8 shrink-0 gap-1.5 text-xs"
          title={
            isOnlyInView
              ? "Mark every house inside the map view as seen"
              : "Mark every house in this feed as seen"
          }
          onClick={handleMarkAllSeen}
        >
          <RiCheckDoubleLine className="size-3.5" />
          Mark {listed.length} seen
        </Button>
      )}
      <Toggle
        variant="outline"
        size="sm"
        pressed={isListVisible}
        onPressedChange={setIsListVisible}
        aria-label="Show the list"
        title="Show the list (l)"
        className="hidden h-8 shrink-0 gap-1.5 text-xs lg:inline-flex"
      >
        <RiListUnordered className="size-3.5" />
        List
      </Toggle>
    </div>
  );

  // Built only while shown — it's ~500 card elements per render otherwise.
  const feedColumn = isListVisible && (
    <div className="z-10 flex w-[420px] shrink-0 flex-col gap-2 overflow-y-auto border-r bg-background p-3 max-lg:absolute max-lg:inset-0 max-lg:w-auto max-lg:border-r-0 max-lg:pb-20">
      {activeQuery.isLoading && visible.length === 0 ? (
        Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={`skeleton-${index}`} className="h-40 w-full" />
        ))
      ) : activeQuery.isError ? (
        <p className="p-4 text-sm text-destructive">
          Couldn't load listings. Is the worker pipeline run and the DB up?
        </p>
      ) : listed.length === 0 ? (
        isOnlyInView && visible.length > 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
            <RiMap2Line className="size-6" />
            <p className="text-sm">
              No houses inside the map view. Pan or zoom out, or turn off "Only
              in view".
            </p>
          </div>
        ) : (
          <EmptyState view={effectiveView} hasCards={cards.length > 0} />
        )
      ) : (
        listed.map((card) => (
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
            onToggleLike={handleToggleLike}
            onToggleHide={handleToggleHide}
            onHover={setHoveredId}
          />
        ))
      )}
    </div>
  );

  const mapPanel = (
    <div className="relative min-h-0 min-w-0 flex-1">
      <ListingMap
        clusters={mapCards}
        likedIds={liked}
        seenIds={hidden}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onSelect={selectInPanel}
        onBoundsChange={setMapBounds}
        onBackgroundClick={handleCloseDetail}
        fitKey={`${query}|${effectiveView}`}
        anchor={anchor}
      />
      <Label className="absolute top-2 left-2 flex items-center gap-2 rounded-md border bg-background/90 px-2.5 py-1.5 text-xs font-normal shadow-sm backdrop-blur">
        <Switch
          checked={isOnlyInView}
          onCheckedChange={setIsOnlyInView}
          aria-label="Only show houses inside the map view"
        />
        Only in view
        <span className="font-mono text-muted-foreground">{inViewCount}</span>
      </Label>
      {detailCard && (
        <MapDetailPanel
          key={detailCard.clusterId}
          card={detailCard}
          anchorLabel={anchor?.label ?? null}
          isLiked={liked.has(detailCard.clusterId)}
          isHidden={hidden.has(detailCard.clusterId)}
          isExpanded={detailCard.clusterId === expandedId}
          onToggleExpand={handleToggleExpand}
          onToggleLike={handleToggleLike}
          onToggleHide={handleToggleHide}
          onOpenInList={handleOpenInList}
          onClose={handleCloseDetail}
        />
      )}
      {/* The legend yields to the panel on a phone, where both sit at the bottom. */}
      <div
        className={cn(
          "pointer-events-none absolute bottom-2 left-2 flex flex-col gap-1 rounded-md border bg-background/90 p-2 text-xs shadow-sm backdrop-blur",
          detailCard && "max-lg:hidden",
        )}
      >
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            {item.swatch}
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col">
      {authEnabled && <TriageSync />}
      {authEnabled && <FilterPrefsSync />}
      <AppHeader
        active="listings"
        isAuthEnabled={authEnabled}
        actions={
          <>
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
          </>
        }
      >
        <span className="font-mono text-sm text-muted-foreground">
          {clusters.isLoading ? "loading…" : `${totalCount} listings`}
        </span>
      </AppHeader>

      <FilterBar config={config.data} />
      {triageBar}

      {/* The map stays mounted whether or not the feed is shown. */}
      <div className="relative flex min-h-0 flex-1">
        {feedColumn}
        {mapPanel}

        <ToggleGroup
          type="single"
          variant="outline"
          value={isListVisible ? "list" : "map"}
          onValueChange={(next) => next && setIsListVisible(next === "list")}
          className="-translate-x-1/2 absolute bottom-4 left-1/2 z-20 rounded-full border bg-background/95 shadow-lg backdrop-blur lg:hidden"
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
