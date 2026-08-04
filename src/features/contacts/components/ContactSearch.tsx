import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ContactSearchProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export function ContactSearch({ value, onChange, placeholder = "Search contacts by name, email, phone, organization..." }: ContactSearchProps) {
  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9 bg-accent/40"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
