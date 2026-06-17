import type { CSSProperties } from "react";

/**
 * Shared recharts axis-tick style. Passed via the `tick` prop (not the `fill`
 * attribute) on purpose: `var()` does NOT resolve in SVG presentation
 * attributes, but it does in an inline `style`, which also wins over recharts'
 * own fill — so the tick color tracks the light/dark theme reliably.
 *
 *   <XAxis tick={AXIS_TICK} ... />
 */
export const AXIS_TICK: { style: CSSProperties } = {
  style: { fill: "var(--color-muted-foreground)" },
};
