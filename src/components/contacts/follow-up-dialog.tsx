"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { CHASE_UP_AFTER_MS, type Contact } from "@/lib/contacts";
import { useFollowUp } from "./use-contacts";

const CHASE_UP_AFTER_DAYS = CHASE_UP_AFTER_MS / 86_400_000;

/**
 * Logs a follow-up (a call, an email, a nudge) on the house's history, with a
 * note on what it was. Mounted only while open; closing calls `onClose`.
 */
export function FollowUpDialog({
  contact,
  onClose,
}: {
  contact: Contact;
  onClose: () => void;
}) {
  const followUp = useFollowUp();
  const [note, setNote] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    followUp.mutate(
      { id: contact.id, note },
      {
        onSuccess: () => {
          onClose();
          toast.success("Follow-up logged", {
            description: `It's in the house's history. You'll be reminded again after ${CHASE_UP_AFTER_DAYS} quiet days.`,
          });
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader className="text-left">
            <DialogTitle>Log a follow-up</DialogTitle>
            <DialogDescription className="truncate">
              {contact.title ?? contact.url}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="follow-up-note">What did you do?</FieldLabel>
            <Textarea
              id="follow-up-note"
              rows={3}
              maxLength={2_000}
              placeholder="Called the agent, left a voicemail. Asked for the energy certificate."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={followUp.isPending}>
              {followUp.isPending ? "Saving…" : "Log follow-up"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
