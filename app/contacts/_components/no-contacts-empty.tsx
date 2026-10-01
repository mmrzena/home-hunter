import { RiContactsBook2Line } from "@remixicon/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function NoContactsEmpty() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RiContactsBook2Line />
        </EmptyMedia>
        <EmptyTitle>No contacted houses yet</EmptyTitle>
        <EmptyDescription>
          Use "Add to contacted" on a listing card or an analysis to keep the
          house here with its contact person, phone, visit date and notes.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/">Browse listings</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
