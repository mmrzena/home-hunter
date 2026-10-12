"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

import { MapUnavailable } from "@/components/map/map-unavailable";
import { useMapLibre } from "@/components/map/use-maplibre";
import { type MarkerKind, markerKind } from "@/lib/listing-status";
import type { MapBounds } from "@/lib/map-bounds";
import { createListingMarker } from "@/lib/map-markers";
import { PRAGUE_CENTER } from "@/lib/map-styles";
import type { AppConfig, ClusterCard } from "@/lib/types";

// Later markers paint on top, so what you care about is never buried.
const STACK_ORDER: Record<MarkerKind, number> = {
  seen: 0,
  other: 1,
  deal: 2,
  liked: 3,
};

export function ListingMap({
  clusters,
  likedIds,
  seenIds,
  selectedId,
  hoveredId,
  onSelect,
  onBoundsChange,
  onBackgroundClick,
  fitKey,
  anchor,
}: {
  clusters: ClusterCard[];
  likedIds: ReadonlySet<number>;
  seenIds: ReadonlySet<number>;
  selectedId: number | null;
  hoveredId: number | null;
  onSelect: (id: number) => void;
  /** Fires after every pan / zoom with the new viewport. */
  onBoundsChange: (bounds: MapBounds) => void;
  /** A tap on the map itself, not on a marker. */
  onBackgroundClick?: () => void;
  /** The map re-fits to all markers only when this changes (filters, tab) —
   *  never when a card merely leaves the list, so your zoom stays put. */
  fitKey: string;
  anchor: AppConfig["anchor"];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { mapRef, isUnavailable } = useMapLibre(containerRef, {
    center: PRAGUE_CENTER,
    zoom: 8,
  });
  const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;
  const onBackgroundClickRef = useRef(onBackgroundClick);
  onBackgroundClickRef.current = onBackgroundClick;
  const lastFitKey = useRef<string | null>(null);

  // Rebuild markers only when the visible set actually changes — its ids,
  // positions, and tones. Toggling triage recomputes the parent's array but
  // leaves this signature identical, so the map stays put.
  const kindOf = (card: ClusterCard) =>
    markerKind(card, {
      isLiked: likedIds.has(card.clusterId),
      isSeen: seenIds.has(card.clusterId),
    });
  const markerSignature = clusters
    .map((card) => `${card.clusterId}@${card.lng},${card.lat}:${kindOf(card)}`)
    .join("|");

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      onBoundsChangeRef.current([
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ]);
    };
    const handleClick = () => onBackgroundClickRef.current?.();
    map.on("moveend", handleMoveEnd);
    map.on("click", handleClick);
    return () => {
      map.off("moveend", handleMoveEnd);
      map.off("click", handleClick);
    };
  }, [mapRef]);

  // Rebuild markers whenever the visible set changes (keyed by signature).
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuild is keyed on markerSignature, which captures the cluster content we read
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current.values()) marker.remove();
    markersRef.current.clear();

    const bounds = new maplibregl.LngLatBounds();
    let any = false;
    const stacked = clusters
      .map((card) => ({ card, kind: kindOf(card) }))
      .sort((a, b) => STACK_ORDER[a.kind] - STACK_ORDER[b.kind]);
    for (const { card, kind } of stacked) {
      if (card.lat == null || card.lng == null) continue;
      const element = createListingMarker({
        kind,
        onClick: () => onSelectRef.current(card.clusterId),
      });
      const marker = new maplibregl.Marker({ element })
        .setLngLat([card.lng, card.lat])
        .addTo(map);
      markersRef.current.set(card.clusterId, marker);
      bounds.extend([card.lng, card.lat]);
      any = true;
    }

    if (anchor) {
      const marker = new maplibregl.Marker({ color: "#2563eb" })
        .setLngLat([anchor.lng, anchor.lat])
        .setPopup(new maplibregl.Popup().setText(anchor.label))
        .addTo(map);
      markersRef.current.set(-1, marker);
      bounds.extend([anchor.lng, anchor.lat]);
      any = true;
    }

    if (any && lastFitKey.current !== fitKey) {
      lastFitKey.current = fitKey;
      map.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 0 });
    }
  }, [markerSignature, anchor, fitKey]);

  // Style markers for selection (purple outline) and hover (faint outline) —
  // without rebuilding them. `clusters` is a real dependency: the rebuild effect
  // recreates the marker DOM on a data change, so styling must re-run afterward
  // to survive a refetch/filter.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-apply after marker rebuild
  useEffect(() => {
    if (!mapRef.current) return;
    for (const [id, marker] of markersRef.current) {
      if (id < 0) continue; // the anchor pin isn't a cluster dot
      const element = marker.getElement();
      const isSelected = id === selectedId;
      const isHovered = id === hoveredId;
      element.style.outline = isSelected
        ? "3px solid #7c3aed"
        : isHovered
          ? "2px solid rgba(124,58,237,.45)"
          : "";
      element.style.zIndex = isSelected ? "10" : isHovered ? "5" : "";
    }
  }, [selectedId, hoveredId, clusters]);

  // Pan to the selected cluster — a single, gentle move. Detail lives in the
  // right-side sheet, so the map only highlights + recenters, never popups.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pan only when the selection changes, not on every cluster-array identity change
  useEffect(() => {
    const map = mapRef.current;
    if (selectedId == null || !map) return;
    const card = clusters.find((entry) => entry.clusterId === selectedId);
    if (card?.lng == null || card.lat == null) return;
    map.easeTo({
      center: [card.lng, card.lat],
      zoom: Math.max(map.getZoom(), 10),
      duration: 400,
    });
  }, [selectedId]);

  if (isUnavailable)
    return <MapUnavailable hint="The listing feed still works fully." />;

  return <div ref={containerRef} className="size-full" />;
}
