import { RiHome4Line } from "@remixicon/react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuthMenu } from "@/components/auth-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const PAGES = [
  { key: "listings", href: "/", label: "Listings" },
  { key: "analyse", href: "/analyse", label: "Analyse" },
  { key: "contacts", href: "/contacts", label: "Contacted" },
] as const;

export type AppPage = (typeof PAGES)[number]["key"];

/**
 * The one header every page shares: brand, page tabs (current page marked),
 * then the page's own extras and the theme + account controls.
 */
export function AppHeader({
  active,
  isAuthEnabled,
  children,
  actions,
}: {
  active: AppPage;
  isAuthEnabled: boolean;
  /** Page-specific status shown after the tabs (e.g. the feed's count). */
  children?: ReactNode;
  /** Page-specific buttons shown before the theme toggle. */
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2">
      <Link href="/" className="flex items-center gap-2">
        <RiHome4Line className="size-5 text-primary" />
        <span className="font-mono font-semibold tracking-tight">
          home-hunter
        </span>
      </Link>
      <nav aria-label="Pages" className="flex items-center gap-0.5">
        {PAGES.map((page) => (
          <Link
            key={page.key}
            href={page.href}
            aria-current={page.key === active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              page.key === active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {page.label}
          </Link>
        ))}
      </nav>
      {children}
      <div className="ml-auto flex items-center gap-1">
        {actions}
        <ThemeToggle />
        {isAuthEnabled && <AuthMenu />}
      </div>
    </header>
  );
}
