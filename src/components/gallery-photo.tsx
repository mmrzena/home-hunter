"use client";

import { RiImageLine } from "@remixicon/react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/** A hot-linked portal photo; a dead URL shows a labelled placeholder, not a blank box. */
export function GalleryPhoto({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const [hasFailed, setHasFailed] = useState(false);
  if (hasFailed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground",
          className,
        )}
      >
        <RiImageLine className="size-6" />
        <span className="text-xs">Photo unavailable</span>
      </div>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: hot-linked portal photo, not bundled
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setHasFailed(true)}
      className={cn("bg-muted object-cover", className)}
    />
  );
}
