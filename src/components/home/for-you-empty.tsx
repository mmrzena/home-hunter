import { RiSparklingLine } from "@remixicon/react";
import { MIN_EXAMPLES } from "@/lib/suggestion-score";

export function ForYouEmpty({
  exampleCount,
}: {
  /** Liked + contacted houses the suggestions were built from; undefined until loaded. */
  exampleCount: number | undefined;
}) {
  const needsMore = exampleCount != null && exampleCount < MIN_EXAMPLES;
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
      <RiSparklingLine className="size-6 text-primary" />
      <p className="text-sm">
        {needsMore
          ? `Like or contact at least ${MIN_EXAMPLES} houses and suggestions appear here. ${exampleCount} so far.`
          : "Nothing left to suggest. Loosen the filters or widen the radius."}
      </p>
    </div>
  );
}
