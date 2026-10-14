"use client";

import { RiCheckLine } from "@remixicon/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Contact } from "@/lib/contacts";
import { FollowUpDialog } from "./follow-up-dialog";

/** "I chased them up" — asks what you did, then logs it and takes the house off the waiting list. */
export function FollowUpButton({
  contact,
  size,
}: {
  contact: Contact;
  size: "xs" | "sm";
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size={size} onClick={() => setIsOpen(true)}>
        {size === "sm" && <RiCheckLine className="size-4" />}
        Followed up
      </Button>
      {isOpen && (
        <FollowUpDialog contact={contact} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
