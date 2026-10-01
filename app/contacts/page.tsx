import type { Metadata } from "next";
import { isAuthConfigured } from "@/lib/env";
import { ContactsScreen } from "./_components/contacts-screen";

export const metadata: Metadata = {
  title: "Contacted houses · home-hunter",
  description: "Houses you've contacted, with visit dates, contacts and notes.",
};

export default function ContactsPage() {
  return <ContactsScreen isAuthEnabled={isAuthConfigured} />;
}
