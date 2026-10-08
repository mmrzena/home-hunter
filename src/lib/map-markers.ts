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
