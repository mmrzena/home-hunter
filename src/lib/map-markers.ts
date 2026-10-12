import type { MarkerKind } from "@/lib/listing-status";

const HEART_PATH =
  "M16.5 3C19.538 3 22 5.5 22 9c0 7-7.5 11-10 12.5C9.5 20 2 16 2 9c0-3.5 2.5-6 5.5-6C9.36 3 11 4 12 5c1-1 2.64-2 4.5-2z";

/** A listing on the map: a heart when liked, a hollow ring when seen, else a
 *  green (good price) or grey dot. Styled inline — it lives outside React. */
export function createListingMarker({
  kind,
  onClick,
}: {
  kind: MarkerKind;
  onClick: () => void;
}): HTMLButtonElement {
  if (kind === "deal")
    return createDotMarker({ color: "#16a34a", size: 18, onClick });
  if (kind === "other")
    return createDotMarker({ color: "#94a3b8", size: 16, onClick });

  const element = createDotMarker({ color: "transparent", size: 16, onClick });
  if (kind === "seen") {
    element.style.border = "2.5px solid #475569";
    element.style.boxShadow = "0 0 0 1px rgba(255,255,255,.8)";
    return element;
  }
  element.style.width = "24px";
  element.style.height = "24px";
  element.style.border = "none";
  element.style.boxShadow = "none";
  element.style.padding = "0";
  element.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,.4))";
  element.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path d="${HEART_PATH}" fill="#f43f5e" stroke="white" stroke-width="1.5"/></svg>`;
  return element;
}

/** A coloured dot marker element for MapLibre, styled inline (it lives outside React). */
export function createDotMarker({
  color,
  size = 16,
  title,
  onClick,
}: {
  color: string;
  size?: number;
  title?: string;
  onClick?: () => void;
}): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  if (title) element.title = title;
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.style.borderRadius = "9999px";
  element.style.border = "2px solid white";
  element.style.boxShadow = "0 1px 3px rgba(0,0,0,.4)";
  element.style.cursor = "pointer";
  element.style.backgroundColor = color;
  if (onClick)
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
  return element;
}
