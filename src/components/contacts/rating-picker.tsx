"use client";

import type { Rating } from "@/db/schema";
import { RATING_LABEL, RATINGS } from "@/lib/contacts";
import { cn } from "@/lib/utils";

/** The visit verdict as five labelled steps, from "No" to "Would buy". */
export function RatingPicker({
  value,
  onChange,
}: {
  value: Rating | null;
  onChange: (rating: Rating | null) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {RATINGS.map((rating) => {
        const isSelected = value === rating;
        return (
          <button
            key={rating}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(isSelected ? null : rating)}
            className={cn(
              "flex flex-col items-center rounded-md border px-1 py-1.5 text-xs transition-colors",
              isSelected
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <span className="font-mono text-sm">{rating}</span>
            <span className="truncate">{RATING_LABEL[rating]}</span>
          </button>
        );
      })}
    </div>
  );
}
