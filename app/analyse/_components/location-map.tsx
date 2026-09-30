"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { RiMapPinLine } from "@remixicon/react";
import maplibregl from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from "@/lib/map-styles";

type Point = { lat: number; lng: number };

function stationLabel(name: string, isFastest: boolean): HTMLElement {
  const element = document.createElement("div");
  element.className = `flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-background/95 py-0.5 pr-2 pl-1 font-medium text-[11px] shadow-sm ${isFastest ? "border-primary text-primary" : "text-foreground"}`;
  const dot = document.createElement("span");
  dot.className = `size-2.5 rounded-full ${isFastest ? "bg-primary" : "bg-foreground/70"}`;
  element.append(dot, name);
  return element;
}

export function LocationMap({
  house,
  stations,
}: {
  house: Point;
  stations: (Point & { name: string; isFastest: boolean })[];
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const style = isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;
  const styleRef = useRef(style);
  const [unavailable, setUnavailable] = useState(false);
  const signature = JSON.stringify([house, stations]);

  // MapLibre is an external system; build it once per house/station set.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuild is keyed on signature, which captures the props we read
  useEffect(() => {
    if (!containerRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: styleRef.current,
        center: [house.lng, house.lat],
        zoom: 12,
        attributionControl: { compact: true },
      });
    } catch {
      setUnavailable(true);
      return;
    }
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    const bounds = new maplibregl.LngLatBounds(
      [house.lng, house.lat],
      [house.lng, house.lat],
    );
    new maplibregl.Marker({ color: "#7c3aed" })
      .setLngLat([house.lng, house.lat])
      .setPopup(new maplibregl.Popup().setText("This house"))
      .addTo(map);
    for (const station of stations) {
      new maplibregl.Marker({
        element: stationLabel(station.name, station.isFastest),
        anchor: "left",
        offset: [-6, 0],
      })
        .setLngLat([station.lng, station.lat])
        .addTo(map);
      bounds.extend([station.lng, station.lat]);
    }
    map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 0 });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [signature]);

  // Only swap on a real theme change; the map was built with the current style.
  useEffect(() => {
    if (style === styleRef.current) return;
    styleRef.current = style;
    mapRef.current?.setStyle(style);
  }, [style]);

  if (unavailable) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted/40 p-6 text-center text-muted-foreground">
        <RiMapPinLine className="size-6" />
        <p className="text-sm">Map needs WebGL, which isn't available here.</p>
      </div>
    );
  }

  return <div ref={containerRef} className="size-full" />;
}
