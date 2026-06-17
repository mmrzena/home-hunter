import * as React from "react";

const DESKTOP_BREAKPOINT = 1024;
const DESKTOP_QUERY = `(min-width: ${DESKTOP_BREAKPOINT}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useIsDesktop() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    // SSR has no viewport; assume desktop so the sidebar is present in the
    // server-rendered HTML. Smaller screens correct themselves on hydration.
    () => true,
  );
}
