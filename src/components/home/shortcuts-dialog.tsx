"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["j"], label: "Next listing" },
  { keys: ["k"], label: "Previous listing" },
  { keys: ["o"], label: "Open details" },
  { keys: ["s"], label: "Shortlist / unshortlist" },
  { keys: ["x"], label: "Mark as seen" },
  { keys: ["r"], label: "Refresh feed" },
  { keys: ["Esc"], label: "Close / clear selection" },
  { keys: ["?"], label: "Toggle this help" },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Triage the feed without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.label}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="text-muted-foreground">{shortcut.label}</span>
              <span className="flex gap-1">
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
