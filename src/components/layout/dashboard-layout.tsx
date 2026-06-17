"use client";

import { RiArrowDownSLine } from "@remixicon/react";
import Link from "next/link";
import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useIsDesktop } from "@/hooks/use-desktop";
import { cn } from "@/lib/utils";

export type DashboardNavItem = {
  /** Optional when the item is a parent section holding nested `items`. */
  href?: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  /** Nested sub-items rendered as a collapsible group. */
  items?: DashboardNavItem[];
};

export type DashboardNavGroup = {
  label?: string;
  items: DashboardNavItem[];
};

export type DashboardLayoutProps = {
  children: React.ReactNode;
  brand?: React.ReactNode;
  navGroups?: DashboardNavGroup[];
  sidebarFooter?: React.ReactNode;
  /**
   * Right-aligned slot in the top bar. Use for user avatar, theme toggle,
   * notifications. Page titles belong inside {children}, not here — render
   * a <PageHeader /> at the top of your page content.
   */
  topBarActions?: React.ReactNode;
  className?: string;
};

export function DashboardLayout({
  children,
  brand,
  navGroups = [],
  sidebarFooter,
  topBarActions,
  className,
}: DashboardLayoutProps) {
  // Collapsed to an icon rail by default below the desktop breakpoint (on
  // phones the sidebar is a sheet that already starts closed); a manual
  // toggle wins over the breakpoint default until the next mount.
  const isDesktop = useIsDesktop();
  const [openOverride, setOpenOverride] = React.useState<boolean | null>(null);

  return (
    <SidebarProvider
      open={openOverride ?? isDesktop}
      onOpenChange={setOpenOverride}
    >
      <Sidebar collapsible="icon">
        {brand ? (
          <SidebarHeader className="overflow-hidden px-4 py-3 text-base font-semibold whitespace-nowrap group-data-[collapsible=icon]:px-2">
            {brand}
          </SidebarHeader>
        ) : null}
        <SidebarContent>
          {navGroups.map((group, idx) => (
            <SidebarGroup key={idx}>
              {group.label ? (
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) =>
                    item.items && item.items.length > 0 ? (
                      <Collapsible
                        key={item.label}
                        asChild
                        defaultOpen={
                          item.active || item.items.some((sub) => sub.active)
                        }
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              isActive={item.active}
                              tooltip={item.label}
                            >
                              {item.icon}
                              <span>{item.label}</span>
                              <RiArrowDownSLine className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.items.map((sub) => (
                                <SidebarMenuSubItem key={sub.href ?? sub.label}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={sub.active}
                                  >
                                    <Link href={sub.href ?? "#"}>
                                      {sub.icon}
                                      <span>{sub.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    ) : (
                      <SidebarMenuItem key={item.href ?? item.label}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.active}
                          tooltip={item.label}
                        >
                          <Link href={item.href ?? "#"}>
                            {item.icon}
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ),
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        {sidebarFooter ? <SidebarFooter>{sidebarFooter}</SidebarFooter> : null}
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
          <SidebarTrigger />
          {topBarActions ? (
            <div className="ml-auto flex items-center gap-2">
              {topBarActions}
            </div>
          ) : null}
        </header>

        <div className={cn("flex-1 px-4 py-6 md:px-6", className)}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
