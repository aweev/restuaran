"use client";
import { useEffect, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { personaFor } from "@/lib/personas";
import { NAV_META } from "@/lib/personas";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { state } = useAuth();
  const persona = personaFor(state.user?.role);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pos:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pos:open-palette", onOpen);
    };
  }, []);

  const go = (href: string) => { setOpen(false); router.push(href); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={`Search actions for ${persona.title}… (orders, tables, menu)`} />
      <CommandList>
        <CommandEmpty>No results. Try “orders”, “tables”, “kitchen”.</CommandEmpty>
        <CommandGroup heading="Quick actions">
          {persona.quickActions.map((a) => (
            <CommandItem key={a.label} value={a.label} onSelect={() => go(a.href)}>
              {a.label} <span className="ml-auto text-xs text-muted-foreground">{a.shortcut ?? ""}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Go to">
          {Object.values(NAV_META).map((n) => (
            <CommandItem key={n.href} value={n.title} onSelect={() => go(n.href)}>{n.title}</CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
