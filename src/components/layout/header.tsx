import Link from "next/link";
import type * as React from "react";

import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
};

export type HeaderProps = {
  logo?: React.ReactNode;
  nav?: NavItem[];
  actions?: React.ReactNode;
  className?: string;
};

export function Header({ logo, nav = [], actions, className }: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className,
      )}
    >
      <div className="container mx-auto flex h-14 items-center gap-6 px-4">
        {logo}

        {nav.length > 0 ? (
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}

        {actions ? (
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
