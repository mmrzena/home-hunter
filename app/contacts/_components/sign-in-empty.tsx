"use client";

import { RiGoogleFill } from "@remixicon/react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { signIn } from "@/lib/auth-client";

export function SignInEmpty() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>Sign in to keep contact notes</EmptyTitle>
        <EmptyDescription>
          Your notes include phone numbers, so they're stored privately on your
          account.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          className="gap-1.5"
          onClick={() =>
            signIn.social({ provider: "google", callbackURL: "/contacts" })
          }
        >
          <RiGoogleFill className="size-4" /> Sign in
        </Button>
      </EmptyContent>
    </Empty>
  );
}
