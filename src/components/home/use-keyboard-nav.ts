"use client";

import { useEffect, useRef } from "react";

type NavHandlers = {
  ids: number[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onOpenDetail: (id: number) => void;
  onShortlist: (id: number) => void;
  onHide: (id: number) => void;
  onRefresh: () => void;
  onClear: () => void;
  onToggleHelp: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Global keyboard triage. The handlers change every render (they close over the
 * current card set), so we keep them in a ref and bind the listener once —
 * integrating the document keydown stream is the textbook case for an effect.
 */
export function useKeyboardNav(handlers: NavHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const handler = ref.current;

      // "?" toggles help from anywhere; everything else yields to text inputs.
      if (event.key === "?") {
        event.preventDefault();
        handler.onToggleHelp();
        return;
      }
      if (
        isTypingTarget(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const { ids, selectedId } = handler;
      const index = selectedId == null ? -1 : ids.indexOf(selectedId);

      switch (event.key) {
        case "j":
        case "ArrowDown": {
          if (!ids.length) return;
          event.preventDefault();
          handler.onSelect(ids[Math.min(index + 1, ids.length - 1)] ?? ids[0]);
          return;
        }
        case "k":
        case "ArrowUp": {
          if (!ids.length) return;
          event.preventDefault();
          handler.onSelect(index <= 0 ? ids[0] : ids[index - 1]);
          return;
        }
        case "o":
        case "Enter": {
          if (selectedId != null) handler.onOpenDetail(selectedId);
          return;
        }
        case "s": {
          if (selectedId != null) handler.onShortlist(selectedId);
          return;
        }
        case "x": {
          if (selectedId == null) return;
          // Step selection to the next card before it leaves the feed.
          const next = ids[index + 1] ?? ids[index - 1] ?? null;
          handler.onHide(selectedId);
          if (next != null) handler.onSelect(next);
          else handler.onClear();
          return;
        }
        case "r": {
          event.preventDefault();
          handler.onRefresh();
          return;
        }
        case "Escape": {
          handler.onClear();
          return;
        }
        default:
          return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
