import type * as React from "react";

import { cn } from "@/lib/utils";

export type FooterLink = {
  href: string;
  label: string;
};

export type FooterSocial = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export type FooterProps = {
  links?: FooterLink[];
  social?: FooterSocial[];
  copyright?: React.ReactNode;
  className?: string;
};

export function Footer({
  links = [],
  social = [],
  copyright,
  className,
}: FooterProps) {
  return (
    <footer
      className={cn(
        "mt-auto border-t border-border bg-background py-8 text-sm text-muted-foreground",
        className,
      )}
    >
      <div className="container mx-auto flex flex-col gap-4 px-4 md:flex-row md:items-center md:justify-between">
        <div>{copyright}</div>

        {links.length > 0 ? (
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}

        {social.length > 0 ? (
          <div className="flex items-center gap-3">
            {social.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className="text-muted-foreground transition-colors hover:text-foreground"
                target="_blank"
                rel="noreferrer"
              >
                {item.icon}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
