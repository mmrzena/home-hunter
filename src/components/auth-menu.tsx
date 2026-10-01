"use client";

import { RiGoogleFill, RiLogoutBoxLine } from "@remixicon/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signIn, signOut, useSession } from "@/lib/auth-client";

/**
 * Sign-in entry point: a Google button when signed out, an avatar menu (email
 * + sign out) when signed in. Only mounted when auth is configured, so the
 * tool still runs as a no-account local app without Google credentials.
 */
export function AuthMenu() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div className="size-8 animate-pulse rounded-full bg-muted" />;
  }

  if (!session?.user) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => signIn.social({ provider: "google" })}
      >
        <RiGoogleFill className="size-4" />
        Sign in
      </Button>
    );
  }

  const { name, email, image } = session.user;
  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          title={email}
        >
          <Avatar className="size-8">
            {image ? <AvatarImage src={image} alt={name ?? email} /> : null}
            <AvatarFallback className="text-xs">{initial}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()}>
          <RiLogoutBoxLine className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
