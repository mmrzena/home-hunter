import type { ReactNode } from "react";

/** A titled list of houses needing attention (visits, chase-ups). */
export function AgendaSection({
  id,
  title,
  children,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-xl border">
      <h2
        id={id}
        className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold"
      >
        {title}
      </h2>
      <ol className="divide-y">{children}</ol>
    </section>
  );
}
