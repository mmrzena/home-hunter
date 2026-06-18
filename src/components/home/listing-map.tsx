"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { RiMapPinLine } from "@remixicon/react";
import maplibregl from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { markerTone, TONE_HEX } from "@/lib/listing-status";
import type { AppConfig, ClusterCard } from "@/lib/types";

// Free, no-key CARTO basemaps — clean Positron in light, matching Dark Matter
// in dark. Both keep the colored markers legible.
const LIGHT_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const DARK_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const PRAGUE: [number, number] = [14.45, 50.0];

export function ListingMap({
  clusters,
  selectedId,
  hoveredId,
  shortlisted,
  onSelect,
  anchor,
}: {
  clusters: ClusterCard[];
  selectedId: number | null;
  hoveredId: number | null;
  shortlisted: ReadonlySet<number>;
  onSelect: (id: number) => void;
  anchor: AppConfig["anchor"];
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Init reads the live theme without re-running its empty-dep effect.
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
  const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  // MapLibre needs WebGL; some machines (GPU blocklists, headless, locked-down
  // VMs) can't provide it. Rather than crash the whole screen, fall back to a
  // placeholder and let the feed carry on.
  const [unavailable, setUnavailable] = useState(false);

  // Rebuild markers only when the visible set actually changes — its ids,
  // positions, and tones. Toggling a shortlist star recomputes the parent's
  // array but leaves this signature identical, so the map stays put.
  const markerSignature = clusters
    .map(
      (card) => `${card.clusterId}@${card.lng},${card.lat}:${markerTone(card)}`,
    )
    .join("|");

  // Init the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: isDarkRef.current ? DARK_STYLE : LIGHT_STYLE,
        center: PRAGUE,
        zoom: 8,
        attributionControl: { compact: true },
      });
    } catch {
      setUnavailable(true);
      return;
    }
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    // The map lives in a resizable panel; MapLibre only tracks window resizes,
    // so observe the container and resize the canvas when the divider moves.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Swap the basemap when the theme toggles. DOM-based markers live outside the
  // style, so they survive setStyle untouched.
  useEffect(() => {
    mapRef.current?.setStyle(isDark ? DARK_STYLE : LIGHT_STYLE);
  }, [isDark]);

  // Rebuild markers whenever the visible set changes (keyed by signature).
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuild is keyed on markerSignature, which captures the cluster content we read
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current.values()) marker.remove();
    markersRef.current.clear();

    const bounds = new maplibregl.LngLatBounds();
    let any = false;
    for (const card of clusters) {
      if (card.lat == null || card.lng == null) continue;
      const element = document.createElement("button");
      element.type = "button";
      element.style.width = "16px";
      element.style.height = "16px";
      element.style.borderRadius = "9999px";
      element.style.border = "2px solid white";
      element.style.boxShadow = "0 1px 3px rgba(0,0,0,.4)";
      element.style.cursor = "pointer";
      element.style.backgroundColor = TONE_HEX[markerTone(card)];
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectRef.current(card.clusterId);
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

    if (any) map.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 0 });
  }, [markerSignature, anchor]);

  // Style markers for selection (purple outline), hover (faint outline), and
  // shortlist (amber ring) — without rebuilding them. `clusters` is a real
  // dependency: the rebuild effect recreates the marker DOM on a data change,
  // so styling must re-run afterward to survive a refetch/filter.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-apply after marker rebuild
  useEffect(() => {
    if (!mapRef.current) return;
    for (const [id, marker] of markersRef.current) {
      if (id < 0) continue; // the anchor pin isn't a cluster dot
      const element = marker.getElement();
      const isSelected = id === selectedId;
      const isHovered = id === hoveredId;
      element.style.boxShadow = shortlisted.has(id)
        ? "0 0 0 2px #f59e0b, 0 1px 3px rgba(0,0,0,.4)"
        : "0 1px 3px rgba(0,0,0,.4)";
      element.style.outline = isSelected
        ? "3px solid #7c3aed"
        : isHovered
          ? "2px solid rgba(124,58,237,.45)"
          : "";
      element.style.zIndex = isSelected ? "10" : isHovered ? "5" : "";
    }
  }, [selectedId, hoveredId, shortlisted, clusters]);

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

  if (unavailable) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted/40 p-6 text-center text-muted-foreground">
        <RiMapPinLine className="size-7" />
        <p className="max-w-xs text-sm">
          Map needs WebGL, which isn't available here. The listing feed still
          works fully.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="size-full" />;
}
