import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * A card action (`data-card-action`) that only shows while its `group/card` is
 * hovered on desktop. A card that needs them always visible overrides this
 * with `SHOW_CARD_ACTIONS`.
 */
export const REVEAL_ON_CARD_HOVER =
  "lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover/card:opacity-100";
/** On a card root: its actions always visible. Outranks the reveal class by
 *  specificity, not stylesheet order (hover and data variants sort unpredictably). */
export const SHOW_CARD_ACTIONS = "[&_[data-card-action]]:lg:opacity-100";

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
