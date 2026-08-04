import type { GoogleContact } from "../types.js";

export function getPrimaryName(contact: GoogleContact): string {
  if (contact.names && contact.names.length > 0) {
    const primary = contact.names.find((n) => (n as any).metadata?.primary) || contact.names[0];
    if (primary) {
      const nameStr = primary.displayName || `${primary.givenName || ""} ${primary.familyName || ""}`.trim();
      if (nameStr) return nameStr;
    }
  }
  if (contact.emails && contact.emails.length > 0 && contact.emails[0]) {
    return contact.emails[0].value;
  }
  if (contact.phones && contact.phones.length > 0 && contact.phones[0]) {
    return contact.phones[0].value;
  }
  return "Unnamed Contact";
}

export function getPrimaryEmail(contact: GoogleContact): string | null {
  if (!contact.emails || contact.emails.length === 0) return null;
  const primary = contact.emails.find((e) => e.primary) || contact.emails[0];
  return primary ? primary.value : null;
}

export function getPrimaryPhone(contact: GoogleContact): string | null {
  if (!contact.phones || contact.phones.length === 0) return null;
  const primary = contact.phones.find((p) => p.primary) || contact.phones[0];
  return primary ? primary.value : null;
}

export function getPrimaryOrganization(contact: GoogleContact): { name: string; title?: string } | null {
  if (!contact.organizations || contact.organizations.length === 0) return null;
  const primary = contact.organizations.find((o) => o.primary) || contact.organizations[0];
  if (!primary || (!primary.name && !primary.title)) return null;
  const res: { name: string; title?: string } = {
    name: primary.name || "Unknown Company",
  };
  if (primary.title) {
    res.title = primary.title;
  }
  return res;
}

export function getPhotoUrl(contact: GoogleContact): string | null {
  if (!contact.photos || contact.photos.length === 0) return null;
  const photo = contact.photos.find((p) => p.primary) || contact.photos[0];
  return photo ? photo.url : null;
}

export function getFormattedBirthday(contact: GoogleContact): string | null {
  if (!contact.birthdays || contact.birthdays.length === 0) return null;
  const bday = contact.birthdays[0];
  if (!bday) return null;
  if (bday.text) return bday.text;
  if (bday.date) {
    const { month, day, year } = bday.date;
    if (month && day) {
      const date = new Date(year || 2000, month - 1, day);
      return date.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        ...(year ? { year: "numeric" } : {}),
      });
    }
  }
  return null;
}

export function formatAddress(contact: GoogleContact): string | null {
  if (!contact.addresses || contact.addresses.length === 0) return null;
  const addr = contact.addresses[0];
  if (!addr) return null;
  if (addr.formattedValue) return addr.formattedValue;
  const parts = [addr.streetAddress, addr.city, addr.region, addr.postalCode, addr.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}
