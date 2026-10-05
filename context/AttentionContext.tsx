"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface AttentionItem {
  id: string;
  at: string;
  title: string;
  message?: string;
  code?: string;
  href?: string;
}

interface AttentionContextType {
  items: AttentionItem[];
  push: (input: Omit<AttentionItem, "id" | "at">) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

const AttentionContext = createContext<AttentionContextType | undefined>(undefined);

const STORAGE_KEY = "pos.attention";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function load(): AttentionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x.id === "string" && typeof x.title === "string").slice(-50);
  } catch {
    return [];
  }
}

export function AttentionProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AttentionItem[]>([]);

  useEffect(() => {
    setItems(load());
    // Replay rejections are written directly to storage by the kernel
    // transport (it cannot import this React context); re-hydrate live.
    const onExternal = () => {
      setItems((prev) => {
        const fresh = load();
        const known = new Set(prev.map((i) => i.id));
        const merged = [...prev, ...fresh.filter((i) => !known.has(i.id))];
        return merged.slice(-50);
      });
    };
    window.addEventListener("pos:attention", onExternal);
    return () => window.removeEventListener("pos:attention", onExternal);
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-50)));
      }
    } catch {
      /* quota / private mode: in-memory only */
    }
  }, [items]);

  const push = useCallback((input: Omit<AttentionItem, "id" | "at">) => {
    setItems((prev) => [...prev, { ...input, id: newId(), at: new Date().toISOString() }].slice(-50));
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => ({ items, push, dismiss, clear }), [items, push, dismiss, clear]);
  return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>;
}

export function useAttention(): AttentionContextType {
  const ctx = useContext(AttentionContext);
  if (!ctx) throw new Error("useAttention must be used within an AttentionProvider");
  return ctx;
}

/** Null-safe variant for rejection paths that may run outside the provider. */
export function useAttentionOptional(): AttentionContextType | null {
  return useContext(AttentionContext) ?? null;
}
