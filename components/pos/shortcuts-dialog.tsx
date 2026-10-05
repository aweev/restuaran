"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "F2", action: "New order" },
  { keys: "F4", action: "Fire course / send to kitchen" },
  { keys: "F8", action: "Checkout / payment" },
  { keys: "Ctrl+K", action: "Command palette / search" },
  { keys: "?", action: "Open this shortcuts overlay" },
  { keys: "Esc", action: "Close dialogs" },
];

/** Keyboard shortcut overlay. Press `?` anywhere to open. */
export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);

  const onKey = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
    if (e.key === "?" && !typing) {
      e.preventDefault();
      setOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-label="Keyboard shortcuts">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <dl className="grid gap-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-muted-foreground">{s.action}</dt>
              <dd>
                <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">{s.keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
