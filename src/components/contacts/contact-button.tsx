"use client";

import { RiContactsBook2Fill, RiContactsBook2Line } from "@remixicon/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import {
  type ContactDetails,
  type ContactHouse,
  contactKey,
} from "@/lib/contacts";
import { cn } from "@/lib/utils";
import { ContactDialog } from "./contact-dialog";
import { useContactsState } from "./contacts-provider";

const EMPTY_DETAILS: ContactDetails = {
  status: "contacted",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  visitAt: "",
  notes: "",
  rating: null,
  pros: "",
  cons: "",
};

/**
 * Marks a house as contacted and opens its notes. Reads the shared contacts
 * state, so cards and the analysis report need no extra wiring. Signed out, it
 * starts Google sign-in (notes hold personal data and live only on the server);
 * with sign-in not configured it renders nothing.
 */
export function ContactButton({
  house,
  suggestedName,
  variant,
}: {
  house: ContactHouse;
  suggestedName?: string | null;
  /** "icon": a feed-card action, shown on hover until the house is contacted. */
  variant: "icon" | "button";
}) {
  const { isAvailable, isSessionPending, canUse, byKey } = useContactsState();
  const [isOpen, setIsOpen] = useState(false);
  const existing = byKey.get(contactKey(house));
  const isContacted = existing !== undefined;
  const label = isContacted ? "Contacted · edit notes" : "Add to contacted";
  const Icon = isContacted ? RiContactsBook2Fill : RiContactsBook2Line;

  function handleClick(event: React.MouseEvent) {
    event.stopPropagation();
    if (isSessionPending) return;
    if (!canUse) {
      signIn.social({ provider: "google", callbackURL: window.location.href });
      return;
    }
    setIsOpen(true);
  }

  if (!isAvailable) return null;

  return (
    <>
      {variant === "button" ? (
        <Button
          variant={isContacted ? "secondary" : "default"}
          className="gap-1.5 rounded-full"
          title={canUse ? undefined : "Sign in to keep contact notes"}
          onClick={handleClick}
        >
          <Icon className="size-4" />
          {label}
        </Button>
      ) : (
        <button
          type="button"
          aria-label={label}
          title={canUse ? label : "Sign in to keep contact notes"}
          onClick={handleClick}
          className={cn(
            "flex size-7 items-center justify-center rounded-md transition-colors",
            isContacted
              ? "text-primary hover:bg-primary/10"
              : "text-muted-foreground hover:bg-muted hover:text-primary lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover/card:opacity-100",
          )}
        >
          <Icon className="size-4" />
        </button>
      )}
      {isOpen && (
        <ContactDialog
          house={house}
          initial={
            existing ?? { ...EMPTY_DETAILS, contactName: suggestedName ?? "" }
          }
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
