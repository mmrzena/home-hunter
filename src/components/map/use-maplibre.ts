"use client";

import maplibregl from "maplibre-gl";
import { useTheme } from "next-themes";
import { type RefObject, useEffect, useRef, useState } from "react";

import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from "@/lib/map-styles";

/**
 * One MapLibre map per container: built once, basemap swapped on theme
 * change, canvas resized with its container, torn down on unmount. MapLibre
 * needs WebGL; where it's missing, `isUnavailable` lets the caller render a
 * placeholder instead of crashing the screen.
 */
export function useMapLibre(
  containerRef: RefObject<HTMLDivElement | null>,
  options: { center: [number, number]; zoom: number },
): { mapRef: RefObject<maplibregl.Map | null>; isUnavailable: boolean } {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Init reads the live theme without re-running its empty-dep effect.
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: isDarkRef.current ? DARK_MAP_STYLE : LIGHT_MAP_STYLE,
        center: optionsRef.current.center,
        zoom: optionsRef.current.zoom,
        attributionControl: { compact: true },
      });
    } catch {
      setIsUnavailable(true);
      return;
    }
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    // MapLibre only tracks window resizes; panels and layout switches resize
    // the container without one.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [containerRef]);

  // DOM-based markers live outside the style, so they survive setStyle untouched.
  useEffect(() => {
    mapRef.current?.setStyle(isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE);
  }, [isDark]);

  return { mapRef, isUnavailable };
}
