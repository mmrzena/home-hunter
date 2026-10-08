import { RiMapPinLine } from "@remixicon/react";

/** Shown in place of a map where WebGL is missing. */
export function MapUnavailable({ hint }: { hint?: string }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted/40 p-6 text-center text-muted-foreground">
      <RiMapPinLine className="size-7" />
      <p className="max-w-xs text-sm">
        Map needs WebGL, which isn't available here.
        {hint && ` ${hint}`}
      </p>
    </div>
  );
}
