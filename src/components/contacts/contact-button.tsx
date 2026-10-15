"use client";

import { RiContactsBook2Fill, RiContactsBook2Line } from "@remixicon/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import { type ContactHouse, contactKey, emptyDetails } from "@/lib/contacts";
import { cn, REVEAL_ON_CARD_HOVER } from "@/lib/utils";
import { ContactDialog } from "./contact-dialog";
import { useContactsState } from "./contacts-provider";
import { useDeleteContact, useSaveContact } from "./use-contacts";

/**
 * Marks a house as contacted in one tap (the toast offers notes and undo);
 * once it's contacted, a tap opens its notes. Reads the shared contacts
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
  const save = useSaveContact();
  const remove = useDeleteContact();
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
    if (isContacted) {
      setIsOpen(true);
      return;
    }
    save.mutate(
      { ...emptyDetails(suggestedName), house },
      {
        onSuccess: ({ contact }) =>
          toast.success("Added to contacted", {
            description: house.title ?? house.url,
            action: { label: "Add notes", onClick: () => setIsOpen(true) },
            cancel: { label: "Undo", onClick: () => remove.mutate(contact.id) },
          }),
      },
    );
  }

  if (!isAvailable) return null;

  return (
    <>
      {variant === "button" ? (
        <Button
          variant={isContacted ? "secondary" : "default"}
          className="gap-1.5 rounded-full"
          title={canUse ? undefined : "Sign in to keep contact notes"}
          disabled={save.isPending}
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
          disabled={save.isPending}
          onClick={handleClick}
          data-card-action=""
          className={cn(
            "flex size-7 items-center justify-center rounded-md transition-colors",
            isContacted
              ? "text-primary hover:bg-primary/10"
              : "text-muted-foreground hover:bg-muted hover:text-primary",
            !isContacted && REVEAL_ON_CARD_HOVER,
          )}
        >
          <Icon className="size-4" />
        </button>
      )}
      {isOpen && (
        <ContactDialog
          house={house}
          initial={existing ?? emptyDetails(suggestedName)}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
