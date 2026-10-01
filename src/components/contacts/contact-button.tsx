"use client";

import { RiContactsBook2Fill, RiContactsBook2Line } from "@remixicon/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signIn, useSession } from "@/lib/auth-client";
import {
  type ContactDetails,
  type ContactHouse,
  contactKey,
  IS_DEV_WITHOUT_SIGN_IN,
} from "@/lib/contacts";
import { cn } from "@/lib/utils";
import { ContactDialog } from "./contact-dialog";
import { useContacts } from "./use-contacts";

const EMPTY_DETAILS: ContactDetails = {
  status: "contacted",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  visitAt: "",
  notes: "",
};

/**
 * Marks a house as contacted and opens its notes. Self-contained (reads the
 * contact list itself) so cards and the analysis report need no extra wiring.
 * Signed out, it starts Google sign-in: notes hold personal data and live only
 * on the server.
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
  const { data: session } = useSession();
  const contacts = useContacts();
  const [isOpen, setIsOpen] = useState(false);
  const existing = contacts.data?.find(
    (contact) => contactKey(contact) === contactKey(house),
  );
  const isContacted = existing !== undefined;
  const canSave = Boolean(session?.user) || IS_DEV_WITHOUT_SIGN_IN;
  const label = isContacted ? "Contacted · edit notes" : "Add to contacted";
  const Icon = isContacted ? RiContactsBook2Fill : RiContactsBook2Line;

  function handleClick(event: React.MouseEvent) {
    event.stopPropagation();
    if (!canSave) {
      signIn.social({ provider: "google", callbackURL: window.location.href });
      return;
    }
    setIsOpen(true);
  }

  return (
    <>
      {variant === "button" ? (
        <Button
          variant={isContacted ? "secondary" : "default"}
          className="gap-1.5 rounded-full"
          title={canSave ? undefined : "Sign in to keep contact notes"}
          onClick={handleClick}
        >
          <Icon className="size-4" />
          {label}
        </Button>
      ) : (
        <button
          type="button"
          aria-label={label}
          title={canSave ? label : "Sign in to keep contact notes"}
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
          isOpen={isOpen}
          onOpenChange={setIsOpen}
        />
      )}
    </>
  );
}
