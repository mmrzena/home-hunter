"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import { formatArea, formatKind, formatPrice } from "@/lib/format";
import { markerTone, TONE_HEX } from "@/lib/listing-status";
import type { AppConfig, ClusterCard } from "@/lib/types";

// Free, no-key CARTO basemaps — clean Positron in light, matching Dark Matter
// in dark. Both keep the colored markers legible.
const LIGHT_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const DARK_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const PRAGUE: [number, number] = [14.45, 50.0];

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] ?? char,
  );
}

/** Minimal house summary rendered inside the marker popup. */
function popupHtml(card: ClusterCard): string {
  const photo = card.photo
    ? `<img src="${escapeHtml(card.photo)}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:6px;display:block" />`
    : "";
  const facts = `${formatKind(card.propertyKind)} · ${formatArea(card.usableAreaM2)}${
    card.landAreaM2 != null ? ` · pozemek ${formatArea(card.landAreaM2)}` : ""
  }`;
  const where = escapeHtml(card.cadastralName ?? card.localityText ?? "");
  const pct =
    card.percentile != null
      ? `<div style="font-size:12px;color:#666">${Math.round(card.percentile)}th pct CZK/m²${
          card.percentileConfidence === "low" ? " · low conf" : ""
        }</div>`
      : "";
  const link = card.url
    ? `<a href="${escapeHtml(card.url)}" target="_blank" rel="noreferrer" style="font-size:12px;color:#2563eb;display:inline-block;margin-top:4px">Open on Sreality →</a>`
    : "";
  return `<div style="width:208px">${photo}<div style="font-weight:600;margin-top:6px">${escapeHtml(
    formatPrice(card.price),
  )}</div><div style="font-size:12px;color:#666">${escapeHtml(facts)}</div><div style="font-size:12px;color:#666">${where}</div>${pct}${link}</div>`;
}

export function ListingMap({
  clusters,
  selectedId,
  onSelect,
  anchor,
}: {
  clusters: ClusterCard[];
  selectedId: number | null;
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
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Open (or re-open) the peek popup for a cluster. Lives in a ref so the marker
  // click handler can call it directly — re-clicking the already-selected dot
  // doesn't change state, so it can't rely on the selection effect re-firing.
  const openPeekRef = useRef<(card: ClusterCard) => void>(() => {});
  openPeekRef.current = (card) => {
    const map = mapRef.current;
    if (!map || card.lng == null || card.lat == null) return;
    map.easeTo({
      center: [card.lng, card.lat],
      zoom: Math.max(map.getZoom(), 10),
      duration: 400,
    });
    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ offset: 16, maxWidth: "232px" })
      .setLngLat([card.lng, card.lat])
      .setHTML(popupHtml(card))
      .addTo(map);
  };

  // Init the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: isDarkRef.current ? DARK_STYLE : LIGHT_STYLE,
      center: PRAGUE,
      zoom: 8,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Swap the basemap when the theme toggles. DOM-based markers and the popup
  // live outside the style, so they survive setStyle untouched.
  useEffect(() => {
    mapRef.current?.setStyle(isDark ? DARK_STYLE : LIGHT_STYLE);
  }, [isDark]);

  // Rebuild markers whenever the cluster set changes.
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
        openPeekRef.current(card);
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
  }, [clusters, anchor]);

  // Fly to + highlight the selected cluster.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, marker] of markersRef.current) {
      const element = marker.getElement();
      element.style.outline = id === selectedId ? "3px solid #7c3aed" : "";
      element.style.zIndex = id === selectedId ? "10" : "";
    }
    if (selectedId == null) {
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }
    const card = clusters.find((entry) => entry.clusterId === selectedId);
    if (card) openPeekRef.current(card);
  }, [selectedId, clusters]);

  return <div ref={containerRef} className="size-full" />;
}
