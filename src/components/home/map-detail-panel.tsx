"use client";

import { RiCloseLine, RiListUnordered } from "@remixicon/react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * The house behind a tapped map pin, floating over the map (which must stay
 * interactive, so not a modal sheet): the card the feed shows, rendered by the
 * caller in detail mode, with a way to the feed and a close. Bottom-anchored on
 * a phone, docked to the right on desktop.
 */
export function MapDetailPanel({
  onOpenInList,
  onClose,
  children,
}: {
  onOpenInList: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-x-2 bottom-16 z-10 flex max-h-[72%] animate-slideUpIn flex-col overflow-hidden rounded-xl border bg-background shadow-xl lg:inset-x-auto lg:top-2 lg:right-2 lg:bottom-auto lg:w-[440px] lg:max-h-[calc(100%-1rem)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-1.5 py-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={onOpenInList}
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
      <div className="min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}
