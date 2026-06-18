"use client";

import { useEffect, useState } from "react";

/**
 * True on lg+ viewports. Drives the split between a resizable feed|map layout
 * (desktop) and a stacked one (mobile). Starts false so SSR and the first client
 * render agree, then corrects on mount — integrating matchMedia is a fair use of
 * an effect.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}
