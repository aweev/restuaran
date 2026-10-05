"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface CashTxn {
  id: string;
  kind: "sale" | "payout" | "drop" | "refund";
  amount: number;
  method: string;
  note?: string;
  at: string;
}

export interface CashSession {
  id: string;
  openedAt: string;
  openedBy?: string;
  startingFloat: number;
  txns: CashTxn[];
  closedAt: string | null;
  countedCash: number | null;
  expected: number | null;
  variance: number | null;
}

interface CashDrawerContextType {
  current: CashSession | null;
  history: CashSession[];
  openDrawer: (startingFloat: number, openedBy?: string) => void;
  recordTxn: (txn: Omit<CashTxn, "id" | "at">) => void;
  closeDrawer: (countedCash: number) => CashSession | null;
}

const CashDrawerContext = createContext<CashDrawerContextType | undefined>(undefined);

const KEY = "pos.cashDrawer.sessions";

function load(): CashSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(sessions: CashSession[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(sessions.slice(-60)));
  } catch {
    /* ignore */
  }
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `cash-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function CashDrawerProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<CashSession[]>([]);

  useEffect(() => {
    setSessions(load());
  }, []);

  useEffect(() => {
    if (sessions.length > 0) persist(sessions);
  }, [sessions]);

  const current = useMemo(() => sessions.find((s) => !s.closedAt) ?? null, [sessions]);
  const history = useMemo(() => sessions.filter((s) => s.closedAt), [sessions]);

  const openDrawer = useCallback((startingFloat: number, openedBy?: string) => {
    const session: CashSession = {
      id: uid(),
      openedAt: new Date().toISOString(),
      openedBy,
      startingFloat,
      txns: [],
      closedAt: null,
      countedCash: null,
      expected: null,
      variance: null,
    };
    setSessions((prev) => {
      // Auto-close a stale open session defensively before opening a new one.
      const prevClosed = prev.map((s) => (s.closedAt ? s : { ...s, closedAt: new Date().toISOString(), countedCash: s.startingFloat, expected: s.startingFloat, variance: 0 }));
      const next = [...prevClosed, session];
      persist(next);
      return next;
    });
  }, []);

  const recordTxn = useCallback((txn: Omit<CashTxn, "id" | "at">) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.closedAt
          ? s
          : { ...s, txns: [...s.txns, { ...txn, id: uid(), at: new Date().toISOString() }] },
      ),
    );
  }, []);

  const closeDrawer = useCallback(
    (countedCash: number) => {
      if (!current) return null;
      const salesCash = current.txns
        .filter((t) => t.kind === "sale" && t.method.toLowerCase() === "cash")
        .reduce((sum, t) => sum + t.amount, 0);
      const payouts = current.txns
        .filter((t) => t.kind !== "sale")
        .reduce((sum, t) => sum + t.amount, 0);
      const expected = current.startingFloat + salesCash - payouts;
      const closed: CashSession = {
        ...current,
        txns: current.txns,
        closedAt: new Date().toISOString(),
        countedCash,
        expected,
        variance: countedCash - expected,
      };
      setSessions((prev) => prev.map((s) => (s.id === current.id ? closed : s)));
      return closed;
    },
    [current],
  );

  const value = useMemo(
    () => ({ current, history, openDrawer, recordTxn, closeDrawer }),
    [current, history, openDrawer, recordTxn, closeDrawer],
  );

  return <CashDrawerContext.Provider value={value}>{children}</CashDrawerContext.Provider>;
}

export function useCashDrawer() {
  const ctx = useContext(CashDrawerContext);
  if (!ctx) throw new Error("useCashDrawer must be used within <CashDrawerProvider>");
  return ctx;
}
