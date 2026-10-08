import type { ContactStatus } from "@/db/schema";

/** Status → dot class (cards, tabs) and hex (map markers), kept in step. */
export const STATUS_DOT: Record<ContactStatus, string> = {
  contacted: "bg-muted-foreground",
  visit_planned: "bg-primary",
  visited: "bg-blueGrey-500",
  offer: "bg-success",
  rejected: "bg-destructive/60",
};

export const STATUS_HEX: Record<ContactStatus, string> = {
  contacted: "#71717a",
  visit_planned: "#7c3aed",
  visited: "#607d8b",
  offer: "#46a147",
  rejected: "#ef4444",
};
