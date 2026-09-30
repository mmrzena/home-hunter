"use client";

import { RiHome4Line } from "@remixicon/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function PropertyGallery({
  photos,
  locality,
}: {
  photos: string[];
  locality?: string;
}) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const photo = photos[selected];
  return (
    <div className="min-w-0">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border bg-muted">
        {photo && !failed.includes(photo) ? (
          // biome-ignore lint/performance/noImgElement: remote portal images with source-specific transforms
          <img
            src={photo}
            alt={`House in ${locality ?? "the listing"}, view ${selected + 1}`}
            className="size-full object-cover"
            onError={() => setFailed([...failed, photo])}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <RiHome4Line className="size-12" />
            <p className="text-sm">
              {photo ? "Photo unavailable" : "No photos supplied"}
            </p>
          </div>
        )}
        {photos.length > 0 && (
          <span className="absolute right-4 bottom-4 rounded-full bg-background/90 px-3 py-1 font-mono text-xs">
            {selected + 1} / {photos.length}
          </span>
        )}
      </div>
      {photos.length > 1 && (
        <section
          className="mt-3 flex gap-2 overflow-x-auto pb-2"
          aria-label="Listing photos"
        >
          {photos.map((src, index) => (
            <button
              type="button"
              key={src}
              onClick={() => setSelected(index)}
              aria-label={`View photo ${index + 1}`}
              aria-pressed={selected === index}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-lg border-2 bg-muted outline-offset-2",
                selected === index
                  ? "border-primary"
                  : "border-transparent opacity-65 hover:opacity-100",
              )}
            >
              {/* biome-ignore lint/performance/noImgElement: portal-hosted gallery */}
              <img
                src={src}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
