import { RiPhoneLine } from "@remixicon/react";

import { Button } from "@/components/ui/button";
import { telHref } from "@/lib/contacts";

/** One-tap call; the number itself only shows where there's room. */
export function CallButton({ phone }: { phone: string }) {
  return (
    <Button asChild variant="outline" size="sm" className="gap-1.5">
      <a href={telHref(phone)}>
        <RiPhoneLine className="size-4" />
        <span className="hidden sm:inline">{phone}</span>
      </a>
    </Button>
  );
}
