"use client";

import type {
  CSSProperties,
  MouseEvent,
  PointerEvent,
  TransitionEvent as ReactTransitionEvent,
} from "react";
import { useRef, useState } from "react";

/**
 * Animate a card out of its list, iOS-style. Two triggers, one exit:
 *   - swiping left past the threshold (touch / pen), or
 *   - calling `dismiss(action, kind)` from a button (works on any input).
 * Either way the row slides fully off its width, then its height collapses to 0
 * so the rows below glide up, and only then does the action run (which is what
 * actually removes the card from the list).
 *
 * `kind` picks the colored reveal beneath the row (seen / restore / like /
 * unlike); during a free drag it shows `swipeKind` (the left-swipe action).
 *
 * `touch-action: pan-y` on the swiped element lets the list scroll vertically
 * untouched; we only claim the gesture once it's clearly horizontal.
 */

export type ExitKind = "seen" | "restore" | "like" | "unlike";

const ENGAGE_PX = 10; // movement before we commit to a direction
const DISMISS_PX = 88; // left-drag distance that triggers the dismiss
const ROW_GAP_PX = 8; // must match the feed's `gap-2`, so collapse closes cleanly
const SLIDE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const SLIDE_MS = 320;
const COLLAPSE_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const COLLAPSE_MS = 220;

type Gesture = { startX: number; startY: number; horizontal: boolean };

export function useSwipeToDismiss({
  swipeKind,
  onSwipe,
}: {
  swipeKind: ExitKind;
  onSwipe: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [sliding, setSliding] = useState(false);
  const [exitKind, setExitKind] = useState<ExitKind | null>(null);
  const slideRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const dxRef = useRef(0);
  const swiped = useRef(false);
  const dismissing = useRef(false);
  const pendingAction = useRef<() => void>(onSwipe);

  const move = (value: number) => {
    dxRef.current = value;
    setDx(value);
  };

  // Phase 2: freeze the row's height, then transition it (and the trailing gap)
  // to zero so the list closes up smoothly before the action removes the card.
  const collapseRow = () => {
    const row = rowRef.current;
    if (!row) {
      pendingAction.current();
      return;
    }
    row.style.height = `${row.offsetHeight}px`;
    row.style.overflow = "hidden";
    void row.offsetHeight; // force reflow so the next change animates
    row.style.transition = `height ${COLLAPSE_MS}ms ${COLLAPSE_EASE}, margin ${COLLAPSE_MS}ms ${COLLAPSE_EASE}, opacity ${COLLAPSE_MS}ms ${COLLAPSE_EASE}`;
    row.style.height = "0px";
    row.style.marginBottom = `-${ROW_GAP_PX}px`;
    row.style.opacity = "0";
    const onEnd = (event: TransitionEvent) => {
      if (event.propertyName !== "height") return;
      row.removeEventListener("transitionend", onEnd);
      pendingAction.current();
    };
    row.addEventListener("transitionend", onEnd);
  };

  // Phase 1: slide the row fully off its own width, then collapse + run `action`.
  const dismiss = (
    action: () => void = onSwipe,
    kind: ExitKind = swipeKind,
  ) => {
    dismissing.current = true;
    pendingAction.current = action;
    setExitKind(kind);
    setSliding(true);
    move(-((slideRef.current?.offsetWidth ?? 512) + 24));
  };

  const slideStyle: CSSProperties = {
    transform: dx !== 0 ? `translateX(${dx}px)` : undefined,
    transition: sliding ? `transform ${SLIDE_MS}ms ${SLIDE_EASE}` : undefined,
  };

  return {
    reveal: dx < 0,
    // 0 → 1 as the drag approaches the commit threshold; `armed` once past it.
    progress: Math.min(1, -dx / DISMISS_PX),
    armed: -dx >= DISMISS_PX,
    kind: exitKind ?? swipeKind,
    rowRef,
    slideStyle,
    dismiss,
    swipeProps: {
      ref: slideRef,
      onPointerDown(event: PointerEvent) {
        if (event.pointerType === "mouse") return;
        gesture.current = {
          startX: event.clientX,
          startY: event.clientY,
          horizontal: false,
        };
        swiped.current = false;
        setSliding(false);
      },
      onPointerMove(event: PointerEvent) {
        const current = gesture.current;
        if (!current) return;
        const moveX = event.clientX - current.startX;
        const moveY = event.clientY - current.startY;
        if (!current.horizontal) {
          if (Math.abs(moveX) < ENGAGE_PX && Math.abs(moveY) < ENGAGE_PX)
            return;
          // A mostly-vertical drag is a scroll — bow out and let the list move.
          if (Math.abs(moveX) <= Math.abs(moveY)) {
            gesture.current = null;
            return;
          }
          current.horizontal = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        const next = Math.min(0, moveX); // dismiss is leftward only
        if (next < -ENGAGE_PX) swiped.current = true;
        move(next);
      },
      onPointerUp() {
        const current = gesture.current;
        gesture.current = null;
        if (!current?.horizontal) return;
        if (dxRef.current <= -DISMISS_PX) {
          dismiss();
        } else {
          setSliding(true);
          move(0);
        }
      },
      onPointerCancel() {
        const current = gesture.current;
        gesture.current = null;
        if (current?.horizontal) {
          setSliding(true);
          move(0);
        }
      },
      onClickCapture(event: MouseEvent) {
        // A finished swipe shouldn't also select the card.
        if (swiped.current) {
          event.preventDefault();
          event.stopPropagation();
          swiped.current = false;
        }
      },
      onTransitionEnd(event: ReactTransitionEvent) {
        if (event.target !== event.currentTarget) return;
        if (event.propertyName !== "transform") return;
        if (dismissing.current) collapseRow();
        else setSliding(false);
      },
    },
  };
}
