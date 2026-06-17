"use client";

import {
  RiAlertLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiInformationLine,
  RiLoader4Line,
} from "@remixicon/react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <RiCheckboxCircleLine className="size-4 text-green-600" />,
        info: <RiInformationLine className="size-4 text-blue-500" />,
        warning: <RiAlertLine className="size-4 text-amber-500" />,
        error: <RiCloseCircleLine className="size-4 text-destructive" />,
        loading: <RiLoader4Line className="size-4 animate-spin" />,
      }}
      // Light per-type tint: redefine sonner's CSS vars (background/border
      // read from --normal-*) by mixing the semantic color into the theme's
      // popover/border colors, so it adapts to dark mode automatically.
      toastOptions={{
        classNames: {
          success:
            "[--normal-bg:color-mix(in_oklab,var(--color-green-600)_10%,var(--popover))] [--normal-border:color-mix(in_oklab,var(--color-green-600)_40%,var(--border))]",
          info: "[--normal-bg:color-mix(in_oklab,var(--color-blue-500)_10%,var(--popover))] [--normal-border:color-mix(in_oklab,var(--color-blue-500)_40%,var(--border))]",
          warning:
            "[--normal-bg:color-mix(in_oklab,var(--color-amber-500)_10%,var(--popover))] [--normal-border:color-mix(in_oklab,var(--color-amber-500)_40%,var(--border))]",
          error:
            "[--normal-bg:color-mix(in_oklab,var(--destructive)_10%,var(--popover))] [--normal-border:color-mix(in_oklab,var(--destructive)_40%,var(--border))]",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
