import { Phone, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ContactCallCardProps {
  name: string;
  phone: string;
  type?: string; // e.g. "Mobile", "Work", "Home"
  photoUrl?: string;
}

export function ContactCallCard({ name, phone, type = "Mobile", photoUrl }: ContactCallCardProps) {
  const cleanPhone = phone.replace(/[^0-9+]/g, "");
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <a
      href={`tel:${cleanPhone}`}
      className="group my-3 block w-full max-w-sm overflow-hidden rounded-2xl border border-border/40 bg-[#161722]/90 p-4 shadow-xl backdrop-blur-md transition-all hover:border-primary/50 hover:bg-[#1c1e2d] hover:shadow-2xl active:scale-[0.99]"
    >
      {/* Header Pill */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <div className="flex size-6 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
          <Phone className="size-3.5" />
        </div>
        <span>Phone</span>
      </div>

      {/* Main Contact Body */}
      <div className="mt-3.5 flex items-center gap-3.5">
        <Avatar className="size-14 border-2 border-primary/20 bg-primary/20 text-primary shadow-inner">
          <AvatarImage src={photoUrl} alt={name} />
          <AvatarFallback className="bg-purple-600 font-bold text-white text-lg">
            {initials || <User className="size-6" />}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold tracking-tight text-white group-hover:text-primary transition-colors">
            {name}
          </h3>
          <p className="truncate text-xs font-medium text-gray-300 mt-0.5">
            {type} · <span className="font-semibold text-white">{phone}</span>
          </p>
        </div>
      </div>
    </a>
  );
}
