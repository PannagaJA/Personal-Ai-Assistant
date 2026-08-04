import { Link } from "react-router-dom";
import { Star, Mail, Phone, Calendar, Building2, User } from "lucide-react";
import type { GoogleContact } from "../types";
import {
  getPrimaryName,
  getPrimaryEmail,
  getPrimaryPhone,
  getPrimaryOrganization,
  getPhotoUrl,
} from "../utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface ContactCardProps {
  contact: GoogleContact;
  onSelect?: (contact: GoogleContact) => void;
  onToggleFavorite?: (resourceName: string, isFavorite: boolean) => void;
}

export function ContactCard({ contact, onSelect, onToggleFavorite }: ContactCardProps) {
  const name = getPrimaryName(contact);
  const email = getPrimaryEmail(contact);
  const phone = getPrimaryPhone(contact);
  const org = getPrimaryOrganization(contact);
  const photo = getPhotoUrl(contact);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      onClick={() => onSelect?.(contact)}
      className="group relative flex flex-col justify-between rounded-xl border bg-card/60 p-4 shadow-sm transition-all hover:bg-accent/40 hover:shadow-md cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-11 border border-border/60">
            <AvatarImage src={photo || undefined} alt={name} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials || <User className="size-5" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {name}
            </h3>
            {org ? (
              <p className="truncate text-xs text-muted-foreground">
                {org.title ? `${org.title}, ` : ""}
                {org.name}
              </p>
            ) : (
              <p className="truncate text-xs text-muted-foreground">
                {email || phone || "No details"}
              </p>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-amber-400 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(contact.resourceName, !contact.isFavorite);
          }}
        >
          <Star
            className={`size-4 ${
              contact.isFavorite ? "fill-amber-400 text-amber-400" : ""
            }`}
          />
        </Button>
      </div>

      {/* Primary details */}
      <div className="mt-3 space-y-1 text-xs text-muted-foreground border-t border-border/40 pt-3">
        {email ? (
          <p className="truncate flex items-center gap-1.5">
            <Mail className="size-3.5 text-primary/70 shrink-0" />
            <span className="truncate">{email}</span>
          </p>
        ) : null}
        {phone ? (
          <p className="truncate flex items-center gap-1.5">
            <Phone className="size-3.5 text-emerald-500/70 shrink-0" />
            <span className="truncate">{phone}</span>
          </p>
        ) : null}
      </div>

      {/* Hover Quick Actions */}
      <div
        className="mt-3 flex items-center justify-end gap-1.5 pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        {email ? (
          <Button variant="ghost" size="icon" className="size-7" asChild title="Email">
            <Link to={`/gmail?to=${encodeURIComponent(email)}`}>
              <Mail className="size-3.5 text-primary" />
            </Link>
          </Button>
        ) : null}
        {phone ? (
          <Button variant="ghost" size="icon" className="size-7" asChild title="Call">
            <a href={`tel:${phone}`}>
              <Phone className="size-3.5 text-emerald-500" />
            </a>
          </Button>
        ) : null}
        <Button variant="ghost" size="icon" className="size-7" asChild title="Schedule Meeting">
          <Link to={`/calendar?attendee=${encodeURIComponent(email || name)}`}>
            <Calendar className="size-3.5 text-sky-500" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
