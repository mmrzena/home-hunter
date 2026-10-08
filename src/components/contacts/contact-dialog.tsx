"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useController, useForm, useWatch } from "react-hook-form";
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
  isAfterVisit,
} from "@/lib/contacts";
import { RatingPicker } from "./rating-picker";
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

/** Mounted only while open; closing calls `onClose` so the parent unmounts it. */
export function ContactDialog({
  house,
  initial,
  onClose,
}: {
  house: ContactHouse;
  initial: ContactDetails;
  onClose: () => void;
}) {
  const save = useSaveContact();
  const form = useForm<FormValues>({
    resolver: zodResolver(FORM),
    // defaultValues, not values: a background refetch must not wipe edits.
    defaultValues: { ...initial, visitAt: toLocalInput(initial.visitAt) },
  });
  const { errors } = form.formState;
  const ratingField = useController({ name: "rating", control: form.control });
  const status = useWatch({ name: "status", control: form.control });

  function handleSubmit(values: FormValues) {
    save.mutate(
      {
        ...values,
        visitAt: values.visitAt ? new Date(values.visitAt).toISOString() : "",
        house,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="inset-0 flex max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg"
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left sm:px-6 sm:py-4">
          <DialogTitle>Contact notes</DialogTitle>
          <DialogDescription className="truncate">
            {house.title ?? house.url}
          </DialogDescription>
        </DialogHeader>
        <form
          id="contact-form"
          onSubmit={form.handleSubmit(handleSubmit)}
          className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:grid-cols-2 sm:p-6"
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
              className="appearance-none"
              aria-invalid={Boolean(errors.visitAt)}
              {...form.register("visitAt")}
            />
            <FieldError errors={[errors.visitAt]} />
          </Field>
          <fieldset className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border p-3 sm:col-span-2">
            <legend className="px-1 text-sm font-medium">
              After the visit
              {!isAfterVisit(status) && (
                <span className="ml-1 font-normal text-muted-foreground">
                  (optional until you've been there)
                </span>
              )}
            </legend>
            <RatingPicker
              value={ratingField.field.value}
              onChange={ratingField.field.onChange}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="contact-pros">What I liked</FieldLabel>
                <Textarea
                  id="contact-pros"
                  rows={3}
                  placeholder="Quiet street, south-facing garden, new roof"
                  {...form.register("pros")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-cons">What bothered me</FieldLabel>
                <Textarea
                  id="contact-cons"
                  rows={3}
                  placeholder="Damp cellar, 15 min walk to the station"
                  {...form.register("cons")}
                />
              </Field>
            </div>
          </fieldset>
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
        <DialogFooter className="shrink-0 border-t p-4 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose}>
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
