"use client";

import {
  RiAlertLine,
  RiArrowDownSLine,
  RiArrowGoBackLine,
  RiArrowRightUpLine,
  RiBuilding2Line,
  RiCloseLine,
  RiExternalLinkLine,
  RiEyeLine,
  RiGroupLine,
  RiHeart3Fill,
  RiHeart3Line,
  RiMapPin2Line,
  RiTrainLine,
} from "@remixicon/react";

import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  formatArea,
  formatDistance,
  formatKind,
  formatPerM2,
  formatPopulation,
  formatPrice,
  formatPriceCompact,
  formatSource,
} from "@/lib/format";
import { statusBadge, TONE_BADGE } from "@/lib/listing-status";
import type { ClusterCard as Card } from "@/lib/types";
import { cn } from "@/lib/utils";

import { PercentileMeter } from "./percentile-meter";
import { type ExitKind, useSwipeToDismiss } from "./use-swipe-to-dismiss";

// Within ~1.5 km is a comfortable walk to the station — flag it as "near train".
const CLOSE_TO_TRAIN_KM = 1.5;

// The colored action revealed beneath a card as it's swiped / dismissed.
const EXIT_STYLES: Record<
  ExitKind,
  { gradient: string; label: string; Icon: typeof RiEyeLine }
> = {
  seen: {
    gradient: "from-zinc-500 to-zinc-600",
    label: "Seen",
    Icon: RiEyeLine,
  },
  restore: {
    gradient: "from-emerald-500 to-green-600",
    label: "Restore",
    Icon: RiArrowGoBackLine,
  },
  like: {
    gradient: "from-rose-500 to-pink-600",
    label: "Liked",
    Icon: RiHeart3Fill,
  },
  unlike: {
    gradient: "from-zinc-500 to-zinc-600",
    label: "Removed",
    Icon: RiHeart3Line,
  },
};

export function ClusterCard({
  card,
  anchorLabel,
  isSelected,
  isLiked,
  isHidden,
  isExpanded,
  onSelect,
  onToggleExpand,
  onToggleLike,
  onToggleHide,
  onHover,
}: {
  card: Card;
  anchorLabel: string | null;
  isSelected: boolean;
  isLiked: boolean;
  isHidden: boolean;
  isExpanded: boolean;
  onSelect: (id: number) => void;
  onToggleExpand: (id: number) => void;
  onToggleLike: (id: number) => void;
  onToggleHide: (id: number) => void;
  onHover: (id: number | null) => void;
}) {
  const badge = statusBadge(card);
  const hasSpread =
    card.minPrice != null &&
    card.maxPrice != null &&
    card.minPrice !== card.maxPrice;
  const {
    reveal,
    progress,
    armed,
    kind,
    rowRef,
    slideStyle,
    dismiss,
    swipeProps,
  } = useSwipeToDismiss({
    swipeKind: isHidden ? "restore" : "seen",
    onSwipe: () => onToggleHide(card.clusterId),
  });
  const exit = EXIT_STYLES[kind];

  return (
    <div
      id={`cluster-card-${card.clusterId}`}
      ref={rowRef}
      className="relative shrink-0 overflow-hidden rounded-lg"
    >
      {/* The action revealed beneath the card as it slides out (swipe or button).
          The badge + label scale and fade in with the drag, then pop on arm. */}
      {reveal && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden rounded-lg bg-gradient-to-l",
            exit.gradient,
          )}
        >
          <div
            className="flex flex-col items-center gap-1 pr-6 text-white"
            style={{
              transform: `scale(${0.6 + progress * 0.4})`,
              opacity: 0.35 + progress * 0.65,
            }}
          >
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-full bg-white/20 shadow-sm ring-1 ring-white/30 transition-transform duration-200",
                armed && "scale-110",
              )}
            >
              <exit.Icon className="size-5" />
            </span>
            <span className="text-xs font-semibold tracking-wide">
              {exit.label}
            </span>
          </div>
        </div>
      )}

      <div
        className={cn(
          "group/card @container relative touch-pan-y overflow-hidden rounded-lg border bg-background transition-[border-color,box-shadow,background-color] duration-150",
          isSelected
            ? "border-primary bg-primary/5 ring-1 ring-primary ring-inset"
            : "border-border hover:bg-muted/40",
          isHidden && "opacity-60",
        )}
        style={slideStyle}
        {...swipeProps}
      >
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => onSelect(card.clusterId)}
            onMouseEnter={() => onHover(card.clusterId)}
            onMouseLeave={() => onHover(null)}
            className="flex flex-1 gap-3 rounded-lg p-3 text-left outline-none"
          >
            {card.photo ? (
              // biome-ignore lint/performance/noImgElement: hot-linked CDN thumbnail, not bundled
              <img
                src={card.photo}
                alt=""
                loading="lazy"
                className="size-16 shrink-0 rounded-md object-cover @sm:size-20 @md:size-24"
              />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground @sm:size-20 @md:size-24">
                <RiMapPin2Line className="size-6" />
              </div>
            )}

            {/* On a wide panel there's room for a second photo — more of the
              house at a glance without expanding. */}
            {card.photos[1] && (
              // biome-ignore lint/performance/noImgElement: hot-linked CDN thumbnail, not bundled
              <img
                src={card.photos[1]}
                alt=""
                loading="lazy"
                className="hidden size-24 shrink-0 rounded-md object-cover @xl:block"
              />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 pr-14">
                {badge && (
                  <Badge className={TONE_BADGE[badge.tone]}>
                    {badge.label}
                  </Badge>
                )}
                {card.isNew && <Badge variant="secondary">New</Badge>}
                {card.priceDropPct != null && card.priceDropPct >= 3 && (
                  <Badge variant="outline">
                    −{Math.round(card.priceDropPct)}%
                  </Badge>
                )}
              </div>

              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-base font-semibold tracking-tight @sm:text-lg">
                  {formatPrice(card.price)}
                </span>
                {hasSpread && (
                  <span className="text-xs text-muted-foreground">
                    {card.memberCount} ads · {formatPriceCompact(card.minPrice)}
                    –{formatPriceCompact(card.maxPrice)}
                  </span>
                )}
              </div>

              <div className="mt-0.5 truncate text-sm text-muted-foreground">
                {formatKind(card.propertyKind)} ·{" "}
                {formatArea(card.usableAreaM2)}
                {card.landAreaM2 != null &&
                  ` · pozemek ${formatArea(card.landAreaM2)}`}
              </div>
              <div className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                <RiMapPin2Line className="size-3.5 shrink-0" />
                {card.cadastralName ?? card.localityText ?? "—"}
                {card.distanceKm != null && (
                  <span className="shrink-0">
                    ·{" "}
                    <span className="font-mono">
                      {formatDistance(card.distanceKm)}
                    </span>
                    {anchorLabel && ` ${anchorLabel}`}
                  </span>
                )}
              </div>

              {(card.pragueKm != null ||
                card.nearestStationKm != null ||
                card.population != null) && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {card.population != null && (
                    <span
                      className="flex items-center gap-1"
                      title={card.settlementClass ?? undefined}
                    >
                      <RiGroupLine className="size-3.5 shrink-0" />
                      <span className="font-mono">
                        {formatPopulation(card.population)}
                      </span>
                    </span>
                  )}
                  {card.pragueKm != null && (
                    <span className="flex items-center gap-1">
                      <RiBuilding2Line className="size-3.5 shrink-0" />
                      <span className="font-mono">
                        {formatDistance(card.pragueKm)}
                      </span>{" "}
                      to Prague
                    </span>
                  )}
                  {card.nearestStationKm != null && (
                    <span
                      className={cn(
                        "flex items-center gap-1",
                        card.nearestStationKm <= CLOSE_TO_TRAIN_KM &&
                          "font-medium text-green-700 dark:text-green-400",
                      )}
                    >
                      <RiTrainLine className="size-3.5 shrink-0" />
                      <span className="font-mono">
                        {formatDistance(card.nearestStationKm)}
                      </span>
                      {card.nearestStationName &&
                        ` · ${card.nearestStationName}`}
                    </span>
                  )}
                </div>
              )}

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

              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">
                  <span className="font-mono">
                    {formatPerM2(card.pricePerUsableM2)}
                  </span>
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
                    {formatSource(card.source)}{" "}
                    <RiExternalLinkLine className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </button>
          <button
            type="button"
            aria-label={isExpanded ? "Hide details" : "Show details"}
            aria-expanded={isExpanded}
            title={isExpanded ? "Hide details (o)" : "Show details (o)"}
            onClick={() => onToggleExpand(card.clusterId)}
            className="flex w-9 shrink-0 items-center justify-center self-stretch text-muted-foreground/60 outline-none transition-colors hover:text-foreground"
          >
            <RiArrowDownSLine
              className={cn(
                "size-5 transition-transform",
                isExpanded && "rotate-180",
              )}
            />
          </button>
        </div>

        {/* Triage actions — siblings of the card button (not nested), so the
          markup stays valid. The heart persists when active; hide reveals on hover. */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            type="button"
            aria-label={isLiked ? "Remove from liked" : "I like it"}
            aria-pressed={isLiked}
            title={isLiked ? "Liked — press s to remove" : "I like it (s)"}
            onClick={() =>
              dismiss(
                () => onToggleLike(card.clusterId),
                isLiked ? "unlike" : "like",
              )
            }
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              isLiked
                ? "text-rose-500 hover:bg-rose-500/10"
                : "text-muted-foreground hover:bg-muted hover:text-rose-500 lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover/card:opacity-100",
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
            title={isHidden ? "Restore" : "Mark seen (x)"}
            onClick={() => dismiss()}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              !isHidden &&
                "lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover/card:opacity-100",
            )}
          >
            {isHidden ? (
              <RiArrowGoBackLine className="size-4" />
            ) : (
              <RiCloseLine className="size-4" />
            )}
          </button>
        </div>

        {/* Inline detail — gallery, description, and the cross-portal sources.
          Siblings of the summary button, so interacting here never toggles it. */}
        {isExpanded && (
          <div className="space-y-3 border-t px-3 pt-3 pb-3">
            {card.photos.length > 0 && (
              <Carousel className="w-full">
                <CarouselContent>
                  {card.photos.map((src) => (
                    <CarouselItem key={src}>
                      {/* biome-ignore lint/performance/noImgElement: hot-linked CDN thumbnail */}
                      <img
                        src={src}
                        alt=""
                        loading="lazy"
                        className="h-44 w-full rounded-md bg-muted object-cover"
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {card.photos.length > 1 && (
                  <>
                    <CarouselPrevious className="left-2" />
                    <CarouselNext className="right-2" />
                  </>
                )}
              </Carousel>
            )}

            {card.description && (
              <p className="line-clamp-6 text-sm text-muted-foreground">
                {card.description}
              </p>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Listed at {card.memberCount}{" "}
                {card.memberCount === 1 ? "place" : "places"}
              </p>
              <ul className="space-y-1">
                {card.members.map((member) => (
                  <li
                    key={`${member.source}:${member.sourceId}`}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span>{formatSource(member.source)}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {formatPrice(member.price)}
                      </span>
                      {member.url && (
                        <a
                          href={member.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          <RiArrowRightUpLine className="size-4" />
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
