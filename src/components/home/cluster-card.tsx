"use client";

import {
  RiAlertLine,
  RiArrowGoBackLine,
  RiCloseLine,
  RiExternalLinkLine,
  RiMapPin2Line,
  RiStarFill,
  RiStarLine,
} from "@remixicon/react";

import { Badge } from "@/components/ui/badge";
import {
  formatArea,
  formatDistance,
  formatKind,
  formatPerM2,
  formatPrice,
  formatPriceCompact,
} from "@/lib/format";
import { statusBadge, TONE_BADGE } from "@/lib/listing-status";
import type { ClusterCard as Card } from "@/lib/types";
import { cn } from "@/lib/utils";

import { PercentileMeter } from "./percentile-meter";

export function ClusterCard({
  card,
  anchorLabel,
  isSelected,
  isShortlisted,
  isHidden,
  onSelect,
  onToggleShortlist,
  onToggleHide,
  onHover,
}: {
  card: Card;
  anchorLabel: string | null;
  isSelected: boolean;
  isShortlisted: boolean;
  isHidden: boolean;
  onSelect: (id: number) => void;
  onToggleShortlist: (id: number) => void;
  onToggleHide: (id: number) => void;
  onHover: (id: number | null) => void;
}) {
  const badge = statusBadge(card);
  const hasSpread =
    card.minPrice != null &&
    card.maxPrice != null &&
    card.minPrice !== card.maxPrice;

  return (
    <div
      id={`cluster-card-${card.clusterId}`}
      className={cn(
        "group/card relative rounded-lg border transition-[border-color,box-shadow,background-color] duration-150",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : isShortlisted
            ? "border-amber-400/70 dark:border-amber-500/50"
            : "border-border hover:bg-muted/40",
        isHidden && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(card.clusterId)}
        onMouseEnter={() => onHover(card.clusterId)}
        onMouseLeave={() => onHover(null)}
        className="flex w-full gap-3 rounded-lg p-3 text-left outline-none"
      >
        {card.photo ? (
          // biome-ignore lint/performance/noImgElement: hot-linked CDN thumbnail, not bundled
          <img
            src={card.photo}
            alt=""
            loading="lazy"
            className="size-24 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex size-24 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <RiMapPin2Line className="size-6" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 pr-14">
            {badge && (
              <Badge className={TONE_BADGE[badge.tone]}>{badge.label}</Badge>
            )}
            {card.isNew && <Badge variant="secondary">New</Badge>}
            {card.priceDropPct != null && card.priceDropPct >= 3 && (
              <Badge variant="outline">−{Math.round(card.priceDropPct)}%</Badge>
            )}
          </div>

          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-semibold">{formatPrice(card.price)}</span>
            {hasSpread && (
              <span className="text-xs text-muted-foreground">
                {card.memberCount} ads · {formatPriceCompact(card.minPrice)}–
                {formatPriceCompact(card.maxPrice)}
              </span>
            )}
          </div>

          <div className="mt-0.5 truncate text-sm text-muted-foreground">
            {formatKind(card.propertyKind)} · {formatArea(card.usableAreaM2)}
            {card.landAreaM2 != null &&
              ` · pozemek ${formatArea(card.landAreaM2)}`}
          </div>
          <div className="flex items-center gap-1 truncate text-sm text-muted-foreground">
            <RiMapPin2Line className="size-3.5 shrink-0" />
            {card.cadastralName ?? card.localityText ?? "—"}
            {card.distanceKm != null && (
              <span className="shrink-0">
                · {formatDistance(card.distanceKm)}
                {anchorLabel && ` ${anchorLabel}`}
              </span>
            )}
          </div>

          <div className="mt-1.5">
            <PercentileMeter
              percentile={card.percentile}
              confidence={card.percentileConfidence}
            />
          </div>

          {card.dealReasons.slice(0, 2).map((reason) => (
            <p
              key={reason.code}
              className="mt-1 text-xs text-green-700 dark:text-green-400"
            >
              ↓ {reason.label}
            </p>
          ))}
          {card.scamReasons.slice(0, 2).map((reason) => (
            <p
              key={reason.code}
              className="mt-1 flex items-center gap-1 text-xs text-red-700 dark:text-red-400"
            >
              <RiAlertLine className="size-3 shrink-0" /> {reason.label}
            </p>
          ))}

          <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              {formatPerM2(card.pricePerUsableM2)}
              {" · "}
              {card.sellerName ??
                (card.sellerType === "private" ? "Soukromá osoba" : "—")}
            </span>
            {card.url && (
              <a
                href={card.url}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
              >
                Sreality <RiExternalLinkLine className="size-3" />
              </a>
            )}
          </div>
        </div>
      </button>

      {/* Triage actions — siblings of the card button (not nested), so the
          markup stays valid. Star persists when active; hide reveals on hover. */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <button
          type="button"
          aria-label={isShortlisted ? "Remove from shortlist" : "Shortlist"}
          aria-pressed={isShortlisted}
          title={isShortlisted ? "Shortlisted — press s" : "Shortlist (s)"}
          onClick={() => onToggleShortlist(card.clusterId)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md transition-colors",
            isShortlisted
              ? "text-amber-500 hover:bg-amber-500/10"
              : "text-muted-foreground opacity-0 hover:bg-muted hover:text-amber-500 focus-visible:opacity-100 group-hover/card:opacity-100",
          )}
        >
          {isShortlisted ? (
            <RiStarFill className="size-4" />
          ) : (
            <RiStarLine className="size-4" />
          )}
        </button>
        <button
          type="button"
          aria-label={isHidden ? "Restore listing" : "Hide listing"}
          title={isHidden ? "Restore" : "Hide (x)"}
          onClick={() => onToggleHide(card.clusterId)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            !isHidden &&
              "opacity-0 focus-visible:opacity-100 group-hover/card:opacity-100",
          )}
        >
          {isHidden ? (
            <RiArrowGoBackLine className="size-4" />
          ) : (
            <RiCloseLine className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
