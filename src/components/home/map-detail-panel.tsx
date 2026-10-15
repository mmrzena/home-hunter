"use client";

import { RiCloseLine, RiListUnordered } from "@remixicon/react";

import { Button } from "@/components/ui/button";
import type { ClusterCard as Card } from "@/lib/types";

import { ClusterCard } from "./cluster-card";

/**
 * The house behind a tapped map pin, floating over the map (which must stay
 * interactive, so not a modal sheet): the same card the feed shows — chevron
 * for the gallery, heart, seen, contact — with a way to the feed and a close.
 * Bottom-anchored on a phone, docked to the right on desktop.
 */
export function MapDetailPanel({
  card,
  anchorLabel,
  isLiked,
  isHidden,
  isExpanded,
  onToggleExpand,
  onToggleLike,
  onToggleHide,
  onOpenInList,
  onClose,
}: {
  card: Card;
  anchorLabel: string | null;
  isLiked: boolean;
  isHidden: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: number) => void;
  onToggleLike: (id: number) => void;
  onToggleHide: (id: number) => void;
  onOpenInList: (card: Card) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-x-2 bottom-16 z-10 flex max-h-[72%] animate-slideUpIn flex-col overflow-hidden rounded-xl border bg-background shadow-xl lg:inset-x-auto lg:top-2 lg:right-2 lg:bottom-auto lg:w-[440px] lg:max-h-[calc(100%-1rem)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-1.5 py-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => onOpenInList(card)}
        >
          <RiListUnordered className="size-3.5" />
          Show in list
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label="Close"
          title="Close (Esc)"
          onClick={onClose}
        >
          <RiCloseLine className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 overflow-y-auto">
        <ClusterCard
          card={card}
          anchorLabel={anchorLabel}
          isSelected={false}
          isLiked={isLiked}
          isHidden={isHidden}
          isExpanded={isExpanded}
          isDetail
          onToggleExpand={onToggleExpand}
          onToggleLike={onToggleLike}
          onToggleHide={onToggleHide}
        />
      </div>
    </div>
  );
}
