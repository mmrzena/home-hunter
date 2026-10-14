"use client";

import { RiCheckLine } from "@remixicon/react";

import { Button } from "@/components/ui/button";
import { useFollowUp } from "./use-contacts";

/** "I chased them up today" — logs it and takes the house off the waiting list. */
export function FollowUpButton({
  contactId,
  size,
}: {
  contactId: number;
  size: "xs" | "sm";
}) {
  const followUp = useFollowUp();
  return (
    <Button
      variant="outline"
      size={size}
      disabled={followUp.isPending}
      title="Log that you chased them up today"
      onClick={() => followUp.mutate(contactId)}
    >
      {size === "sm" && <RiCheckLine className="size-4" />}
      Followed up
    </Button>
  );
}
