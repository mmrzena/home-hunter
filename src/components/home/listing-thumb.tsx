import { RiMapPin2Line } from "@remixicon/react";

import { cn } from "@/lib/utils";

export function ListingThumb({
  src,
  className,
}: {
  src: string | null;
  className: string;
}) {
  if (!src)
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
          className,
        )}
      >
        <RiMapPin2Line className="size-6" />
      </div>
    );

  return (
    // biome-ignore lint/performance/noImgElement: hot-linked CDN thumbnail, not bundled
    <img
      src={src}
      alt=""
      loading="lazy"
      className={cn("shrink-0 rounded-md object-cover", className)}
    />
  );
}
