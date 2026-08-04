import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Search as SearchIcon,
  Star,
  Building2,
  Clock,
  Plus,
  RefreshCw,
  Mail,
  Phone,
  Calendar,
  UserCheck,
} from "lucide-react";
import { useContacts } from "@/features/contacts/hooks/use-contacts";
import { ContactCard } from "@/features/contacts/components/ContactCard";
import { ContactProfileDialog } from "@/features/contacts/components/ContactProfileDialog";
import { ContactSearch } from "@/features/contacts/components/ContactSearch";
import type { GoogleContact } from "@/features/contacts/types";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPrimaryOrganization } from "@/features/contacts/utils";

type TabFilter = "all" | "favorites" | "organizations" | "recent";

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [selectedContact, setSelectedContact] = useState<GoogleContact | null>(null);

  const { contacts, isLoading, refetch, toggleFavorite } = useContacts({
    query: searchQuery,
  });

  // Filter contacts based on active tab
  const filteredContacts = contacts.filter((contact) => {
    if (activeTab === "favorites") return contact.isFavorite;
    if (activeTab === "organizations") {
      const org = getPrimaryOrganization(contact);
      return Boolean(org && org.name);
    }
    if (activeTab === "recent") return contact.isFrequentlyContacted || Boolean(contact.lastSyncedAt);
    return true;
  });

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Google Contacts directory & relationship network
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="size-3.5" />
              Sync Contacts
            </Button>
          </div>
        </div>

        {/* Search and Navigation Bar */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 max-w-md">
            <ContactSearch value={searchQuery} onChange={setSearchQuery} />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border bg-card/60 p-1">
            <Button
              variant={activeTab === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("all")}
              className="gap-1.5 text-xs"
            >
              <Users className="size-3.5" />
              All ({contacts.length})
            </Button>

            <Button
              variant={activeTab === "favorites" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("favorites")}
              className="gap-1.5 text-xs"
            >
              <Star className="size-3.5 text-amber-400" />
              Favorites ({contacts.filter((c) => c.isFavorite).length})
            </Button>

            <Button
              variant={activeTab === "organizations" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("organizations")}
              className="gap-1.5 text-xs"
            >
              <Building2 className="size-3.5 text-indigo-400" />
              Organizations
            </Button>

            <Button
              variant={activeTab === "recent" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("recent")}
              className="gap-1.5 text-xs"
            >
              <Clock className="size-3.5 text-emerald-400" />
              Recent
            </Button>
          </div>
        </div>

        {/* Contacts Grid */}
        <div className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
              <Users className="size-10 text-muted-foreground/50" />
              <h3 className="mt-3 text-base font-semibold">No contacts found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery
                  ? `No contact details match "${searchQuery}".`
                  : activeTab === "favorites"
                  ? "Star contacts to see them in your favorites list."
                  : "No Google contacts imported yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredContacts.map((contact) => (
                <ContactCard
                  key={contact.resourceName}
                  contact={contact}
                  onSelect={(c) => setSelectedContact(c)}
                  onToggleFavorite={(resName, fav) =>
                    toggleFavorite.mutate({ resourceName: resName, isFavorite: fav })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Profile Detail Dialog */}
      <ContactProfileDialog
        contact={selectedContact}
        open={Boolean(selectedContact)}
        onOpenChange={(open) => {
          if (!open) setSelectedContact(null);
        }}
        onToggleFavorite={(resName, fav) => {
          toggleFavorite.mutate({ resourceName: resName, isFavorite: fav });
          if (selectedContact) {
            setSelectedContact({ ...selectedContact, isFavorite: fav });
          }
        }}
      />
    </AppShell>
  );
}
