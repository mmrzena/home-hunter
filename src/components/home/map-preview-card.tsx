"use client";

import {
  RiArrowGoBackLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiEyeLine,
  RiHeart3Fill,
  RiHeart3Line,
} from "@remixicon/react";

import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { statusBadge, TONE_BADGE } from "@/lib/listing-status";
import type { ClusterCard } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ListingFacts } from "./listing-facts";
import { ListingThumb } from "./listing-thumb";
import { PercentileMeter } from "./percentile-meter";

export function MapPreviewCard({
  card,
  anchorLabel,
  isLiked,
  isHidden,
  onOpen,
  onToggleLike,
  onToggleHide,
  onClose,
  className,
}: {
  card: ClusterCard;
  anchorLabel: string | null;
  isLiked: boolean;
  isHidden: boolean;
  onOpen: (card: ClusterCard) => void;
  onToggleLike: (id: number) => void;
  onToggleHide: (id: number) => void;
  onClose: () => void;
  className?: string;
}) {
  const badge = statusBadge(card);

  return (
    <div
      className={cn(
        "relative animate-slideUpIn overflow-hidden rounded-xl border bg-background shadow-xl",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(card)}
        className="flex w-full gap-3 p-3 pr-24 text-left outline-none"
      >
        <ListingThumb src={card.photo} className="size-20" />

        <div className="min-w-0 flex-1">
          {badge && (
            <Badge className={TONE_BADGE[badge.tone]}>{badge.label}</Badge>
          )}
          <div className="mt-1 font-mono text-base font-semibold tracking-tight">
            {formatPrice(card.price)}
          </div>
          <ListingFacts card={card} anchorLabel={anchorLabel} />
          <div className="mt-1.5">
            <PercentileMeter
              percentile={card.percentile}
              confidence={card.percentileConfidence}
              isLandAdjusted={card.priceBasis === "building"}
            />
          </div>
        </div>
      </button>

      <div className="absolute top-2 right-2 flex items-center gap-0.5">
        <button
          type="button"
          aria-label={isLiked ? "Remove from liked" : "I like it"}
          aria-pressed={isLiked}
          onClick={() => onToggleLike(card.clusterId)}
          className={cn(
            "flex size-8 items-center justify-center rounded-md transition-colors hover:bg-muted",
            isLiked ? "text-rose-500" : "text-muted-foreground",
          )}
        >
          {isLiked ? (
            <RiHeart3Fill className="size-4" />
          ) : (
            <RiHeart3Line className="size-4" />
          )}
        </button>
        <button
          type="button"
          aria-label={isHidden ? "Restore listing" : "Mark as seen"}
          onClick={() => onToggleHide(card.clusterId)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
        >
          {isHidden ? (
            <RiArrowGoBackLine className="size-4" />
          ) : (
            <RiEyeLine className="size-4" />
          )}
        </button>
        <button
          type="button"
          aria-label="Close preview"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
        >
          <RiCloseLine className="size-4" />
        </button>
      </div>

      <RiArrowRightSLine className="pointer-events-none absolute right-2 bottom-3 size-5 text-muted-foreground" />
    </div>
  );
}
