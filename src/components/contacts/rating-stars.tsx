import { RiStarFill, RiStarLine } from "@remixicon/react";

import type { Rating } from "@/db/schema";
import { RATING_LABEL, RATINGS } from "@/lib/contacts";

/** A verdict as stars + label; `isCompact` shows one star and the number. */
export function RatingStars({
  rating,
  isCompact = false,
}: {
  rating: Rating;
  isCompact?: boolean;
}) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap text-xs">
      {isCompact ? (
        <>
          <RiStarFill className="size-3.5 text-amber-500" />
          <span className="font-mono text-sm">{rating}</span>
        </>
      ) : (
        RATINGS.map((step) =>
          step <= rating ? (
            <RiStarFill key={step} className="size-3.5 text-amber-500" />
          ) : (
            <RiStarLine
              key={step}
              className="size-3.5 text-muted-foreground/50"
            />
          ),
        )
      )}
      <span className="ml-0.5">{RATING_LABEL[rating]}</span>
    </span>
  );
}
