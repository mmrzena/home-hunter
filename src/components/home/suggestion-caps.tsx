"use client";

import {
  SUGGESTION_LIMITS,
  SUGGESTION_RADII_KM,
  type SuggestionLimit,
  type SuggestionRadiusKm,
} from "@/lib/suggestion-score";
import { CapSelect } from "./cap-select";

export function SuggestionCaps({
  limit,
  radiusKm,
  onLimitChange,
  onRadiusChange,
}: {
  limit: SuggestionLimit;
  radiusKm: SuggestionRadiusKm | null;
  onLimitChange: (limit: SuggestionLimit) => void;
  onRadiusChange: (radiusKm: SuggestionRadiusKm | null) => void;
}) {
  return (
    <>
      <CapSelect
        options={SUGGESTION_LIMITS}
        value={limit}
        label="How many suggestions"
        format={(option) => `Top ${option}`}
        className="h-8 w-[92px] shrink-0 text-xs"
        onChange={(next) => next != null && onLimitChange(next)}
      />
      <CapSelect
        options={SUGGESTION_RADII_KM}
        value={radiusKm}
        label="How far from a house you picked"
        format={(option) => `Within ${option} km of a pick`}
        noneLabel="Anywhere"
        className="h-8 w-[150px] shrink-0 text-xs"
        onChange={onRadiusChange}
      />
    </>
  );
}
