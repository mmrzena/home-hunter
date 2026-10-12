import { RiMapPin2Line } from "@remixicon/react";

import { formatArea, formatDistance, formatKind } from "@/lib/format";
import type { ClusterCard } from "@/lib/types";

export function ListingFacts({
  card,
  anchorLabel,
}: {
  card: ClusterCard;
  anchorLabel: string | null;
}) {
  return (
    <>
      <div className="mt-0.5 truncate text-sm text-muted-foreground">
        {formatKind(card.propertyKind)} · {formatArea(card.usableAreaM2)}
        {card.landAreaM2 != null && ` · pozemek ${formatArea(card.landAreaM2)}`}
      </div>
      <div className="flex items-center gap-1 truncate text-sm text-muted-foreground">
        <RiMapPin2Line className="size-3.5 shrink-0" />
        {card.cadastralName ?? card.localityText ?? "—"}
        {card.distanceKm != null && (
          <span className="shrink-0">
            ·{" "}
            <span className="font-mono">{formatDistance(card.distanceKm)}</span>
            {anchorLabel && ` ${anchorLabel}`}
          </span>
        )}
      </div>
    </>
  );
}
