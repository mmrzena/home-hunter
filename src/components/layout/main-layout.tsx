import type * as React from "react";

import { cn } from "@/lib/utils";
import { Footer, type FooterProps } from "./footer";
import { Header, type HeaderProps } from "./header";

export type MainLayoutProps = {
  children: React.ReactNode;
  header?: HeaderProps;
  footer?: FooterProps;
  className?: string;
};

export function MainLayout({
  children,
  header = {},
  footer = {},
  className,
}: MainLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header {...header} />
      <main className={cn("flex-1", className)}>{children}</main>
      <Footer {...footer} />
    </div>
  );
}
