"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

import { MapUnavailable } from "@/components/map/map-unavailable";
import { useMapLibre } from "@/components/map/use-maplibre";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const { mapRef, isUnavailable } = useMapLibre(containerRef, {
    center: [house.lng, house.lat],
    zoom: 12,
  });
  const signature = JSON.stringify([house, stations]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: markers are rebuilt on signature, which captures the props we read
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = new maplibregl.LngLatBounds(
      [house.lng, house.lat],
      [house.lng, house.lat],
    );
    const markers = [
      new maplibregl.Marker({ color: "#7c3aed" })
        .setLngLat([house.lng, house.lat])
        .setPopup(new maplibregl.Popup().setText("This house"))
        .addTo(map),
    ];
    for (const station of stations) {
      markers.push(
        new maplibregl.Marker({
          element: stationLabel(station.name, station.isFastest),
          anchor: "left",
          offset: [-6, 0],
        })
          .setLngLat([station.lng, station.lat])
          .addTo(map),
      );
      bounds.extend([station.lng, station.lat]);
    }
    map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 0 });
    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [signature]);

  if (isUnavailable) return <MapUnavailable />;

  return <div ref={containerRef} className="size-full" />;
}
