import { useState } from "react";
import { Link } from "react-router-dom";
import { Star, Mail, Phone, Calendar, Building2, MapPin, Cake, ExternalLink, User } from "lucide-react";
import type { GoogleContact } from "../types";
import {
  getPrimaryName,
  getPrimaryEmail,
  getPrimaryPhone,
  getPrimaryOrganization,
  getPhotoUrl,
  getFormattedBirthday,
  formatAddress,
} from "../utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface ContactProfileDialogProps {
  contact: GoogleContact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleFavorite?: (resourceName: string, isFavorite: boolean) => void;
}

export function ContactProfileDialog({
  contact,
  open,
  onOpenChange,
  onToggleFavorite,
}: ContactProfileDialogProps) {
  if (!contact) return null;

  const name = getPrimaryName(contact);
  const email = getPrimaryEmail(contact);
  const phone = getPrimaryPhone(contact);
  const org = getPrimaryOrganization(contact);
  const photo = getPhotoUrl(contact);
  const birthday = getFormattedBirthday(contact);
  const address = formatAddress(contact);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0 sm:max-w-lg">
        {/* Cover / Header Header Banner */}
        <div className="relative h-28 bg-gradient-to-r from-primary/30 via-accent/50 to-primary/20 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleFavorite?.(contact.resourceName, !contact.isFavorite)}
            className="absolute top-3 right-3 rounded-full bg-background/80 hover:bg-background"
          >
            <Star
              className={`size-4 ${
                contact.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
              }`}
            />
          </Button>
        </div>

        <div className="px-6 pb-6 pt-0">
          {/* Avatar & Basic Info */}
          <div className="-mt-12 flex items-end gap-4">
            <Avatar className="size-20 border-4 border-background shadow-md">
              <AvatarImage src={photo || undefined} alt={name} />
              <AvatarFallback className="text-xl font-bold bg-primary/20 text-primary">
                {initials || <User className="size-8" />}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 pb-1">
              <h2 className="truncate text-xl font-bold text-foreground">{name}</h2>
              {org ? (
                <p className="truncate text-sm text-muted-foreground">
                  {org.title ? `${org.title} at ` : ""}
                  <span className="font-medium text-foreground">{org.name}</span>
                </p>
              ) : null}
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            {email ? (
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link to={`/gmail?to=${encodeURIComponent(email)}`}>
                  <Mail className="size-3.5 text-primary" />
                  Email
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-50">
                <Mail className="size-3.5" />
                Email
              </Button>
            )}

            {phone ? (
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <a href={`tel:${phone}`}>
                  <Phone className="size-3.5 text-emerald-500" />
                  Call
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-50">
                <Phone className="size-3.5" />
                Call
              </Button>
            )}

            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link to={`/calendar?attendee=${encodeURIComponent(email || name)}`}>
                <Calendar className="size-3.5 text-sky-500" />
                Meet
              </Link>
            </Button>
          </div>

          {/* Detailed Info List */}
          <div className="mt-6 space-y-4 rounded-lg bg-accent/30 p-4 text-sm">
            {email ? (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Email Address</p>
                  <p className="font-medium text-foreground select-all">{email}</p>
                </div>
              </div>
            ) : null}

            {phone ? (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Phone Number</p>
                  <p className="font-medium text-foreground select-all">{phone}</p>
                </div>
              </div>
            ) : null}

            {org ? (
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Organization</p>
                  <p className="font-medium text-foreground">{org.name}</p>
                  {org.title && <p className="text-xs text-muted-foreground">{org.title}</p>}
                </div>
              </div>
            ) : null}

            {address ? (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Address</p>
                  <p className="font-medium text-foreground">{address}</p>
                </div>
              </div>
            ) : null}

            {birthday ? (
              <div className="flex items-start gap-3">
                <Cake className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Birthday</p>
                  <p className="font-medium text-foreground">{birthday}</p>
                </div>
              </div>
            ) : null}

            {contact.biographies && contact.biographies.length > 0 && contact.biographies[0]?.value ? (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground font-medium">Notes</p>
                <p className="mt-1 text-xs text-foreground/90 whitespace-pre-wrap">
                  {contact.biographies[0].value}
                </p>
              </div>
            ) : null}
          </div>

          {/* AI Tags */}
          {contact.aiTags && contact.aiTags.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium mr-1">AI Tags:</span>
              {contact.aiTags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-[11px]">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
