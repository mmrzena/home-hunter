"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTACT_DETAILS,
  CONTACT_STATUS_LABEL,
  CONTACT_STATUSES,
  type ContactDetails,
  type ContactHouse,
} from "@/lib/contacts";
import { useSaveContact } from "./use-contacts";

// The form edits the visit in the browser's local time (datetime-local).
const FORM = CONTACT_DETAILS.extend({
  visitAt: z.union([
    z.literal(""),
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time"),
  ]),
});
type FormValues = z.infer<typeof FORM>;

/** ISO instant → "YYYY-MM-DDTHH:mm" in local time, for datetime-local. */
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ContactDialog({
  house,
  initial,
  isOpen,
  onOpenChange,
}: {
  house: ContactHouse;
  initial: ContactDetails;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const save = useSaveContact();
  const form = useForm<FormValues>({
    resolver: zodResolver(FORM),
    values: { ...initial, visitAt: toLocalInput(initial.visitAt) },
  });
  const { errors } = form.formState;

  function handleSubmit(values: FormValues) {
    save.mutate(
      {
        ...values,
        visitAt: values.visitAt ? new Date(values.visitAt).toISOString() : "",
        house,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact notes</DialogTitle>
          <DialogDescription className="truncate">
            {house.title ?? house.url}
          </DialogDescription>
        </DialogHeader>
        <form
          id="contact-form"
          onSubmit={form.handleSubmit(handleSubmit)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="contact-status">Status</FieldLabel>
            <NativeSelect id="contact-status" {...form.register("status")}>
              {CONTACT_STATUSES.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {CONTACT_STATUS_LABEL[status]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-name">Contact person</FieldLabel>
            <Input
              id="contact-name"
              autoComplete="off"
              placeholder="Jana Nováková"
              {...form.register("contactName")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-phone">Phone</FieldLabel>
            <Input
              id="contact-phone"
              type="tel"
              autoComplete="off"
              placeholder="+420 777 123 456"
              aria-invalid={Boolean(errors.contactPhone)}
              {...form.register("contactPhone")}
            />
            <FieldError errors={[errors.contactPhone]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-email">Email</FieldLabel>
            <Input
              id="contact-email"
              type="email"
              autoComplete="off"
              aria-invalid={Boolean(errors.contactEmail)}
              {...form.register("contactEmail")}
            />
            <FieldError errors={[errors.contactEmail]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-visit">Visit</FieldLabel>
            <Input
              id="contact-visit"
              type="datetime-local"
              aria-invalid={Boolean(errors.visitAt)}
              {...form.register("visitAt")}
            />
            <FieldError errors={[errors.visitAt]} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="contact-notes">Notes</FieldLabel>
            <Textarea
              id="contact-notes"
              rows={5}
              placeholder="1 Oct: messaged the agent via Sreality. Asked about the roof and heating costs."
              {...form.register("notes")}
            />
            <FieldError errors={[errors.notes]} />
          </Field>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="contact-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
