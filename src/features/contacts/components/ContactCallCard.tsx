import { Phone, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface PhoneEntry {
  type: string;
  value: string;
}

interface ContactCallCardProps {
  name: string;
  phones?: PhoneEntry[];
  phone?: string;
  type?: string;
  photoUrl?: string;
}

export function ContactCallCard({ name, phones, phone, type = "Mobile", photoUrl }: ContactCallCardProps) {
  const rawList: PhoneEntry[] =
    phones && phones.length > 0
      ? phones
      : phone
      ? [{ type, value: phone }]
      : [];

  // Deduplicate and clean phone values by digits
  const phoneMap = new Map<string, PhoneEntry>();
  for (const item of rawList) {
    if (!item || !item.value) continue;
    // Strip markdown links and tel: prefixes
    const cleanVal = item.value
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/tel:[^\s)]*/gi, "")
      .replace(/[\[\]()]/g, "")
      .trim();

    const cleanDigits = cleanVal.replace(/[^0-9+]/g, "");
    if (!cleanDigits) continue;

    if (!phoneMap.has(cleanDigits)) {
      phoneMap.set(cleanDigits, {
        type: item.type || "Mobile",
        value: cleanVal || cleanDigits,
      });
    }
  }

  const phoneList = Array.from(phoneMap.values());
  const primaryPhone = phoneList[0]?.value || phone || "";
  const cleanPrimary = primaryPhone.replace(/[^0-9+]/g, "");

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="group my-3 block w-full max-w-sm overflow-hidden rounded-2xl border border-border/40 bg-[#161722]/90 p-4 shadow-xl backdrop-blur-md transition-all hover:border-primary/50 hover:bg-[#1c1e2d] hover:shadow-2xl">
      {/* Header Pill */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <div className="flex size-6 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
          <Phone className="size-3.5" />
        </div>
        <span>Phone Contact</span>
      </div>

      {/* Main Contact Body */}
      <div className="mt-3.5 flex items-start gap-3.5">
        <a
          href={`tel:${cleanPrimary}`}
          title={`Call ${name}`}
          className="shrink-0 transition-transform active:scale-95"
        >
          <Avatar className="size-14 border-2 border-primary/20 bg-primary/20 text-primary shadow-inner">
            <AvatarImage src={photoUrl} alt={name} />
            <AvatarFallback className="bg-purple-600 font-bold text-white text-lg">
              {initials || <User className="size-6" />}
            </AvatarFallback>
          </Avatar>
        </a>

        <div className="min-w-0 flex-1">
          <a
            href={`tel:${cleanPrimary}`}
            className="truncate text-base font-bold tracking-tight text-white transition-colors hover:text-primary block"
          >
            {name}
          </a>

          <div className="mt-2 space-y-1.5">
            {phoneList.map((p, idx) => {
              const clean = p.value.replace(/[^0-9+]/g, "");
              return (
                <a
                  key={idx}
                  href={`tel:${clean}`}
                  title={`Call ${p.type || "Mobile"}: ${p.value}`}
                  className="group/btn flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-white active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 group-hover/btn:bg-emerald-500 group-hover/btn:text-white transition-colors">
                      <Phone className="size-3" />
                    </div>
                    <span className="font-medium text-gray-300 truncate">{p.type || "Mobile"}</span>
                  </div>
                  <span className="font-semibold text-sky-300 group-hover/btn:text-emerald-300 shrink-0 font-mono">
                    {p.value}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
