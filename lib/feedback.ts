"use client";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

/** Safari still exposes the prefixed constructor; typed without `any`. */
type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }
type VibratingNavigator = Navigator & { vibrate?: (pattern: number | number[]) => boolean }

let audioCtx: AudioContext | null = null;

export function playTone(kind: "success" | "error" | "tap" = "tap") {
  try {
    if (typeof window === "undefined") return;
    const Ctx = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    const freq = kind === "success" ? 660 : kind === "error" ? 180 : 440;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "tap" ? 0.09 : 0.22));
    osc.start(now); osc.stop(now + 0.25);
  } catch { /* silent */ }
}

export function haptic(pattern: number | number[] = 12) {
  try { (navigator as VibratingNavigator).vibrate?.(pattern); } catch { /* noop */ }
}

export interface RecoveryAction {
  label: string;
  run: () => void | Promise<void>;
}

/** Server-suggested action wire shape (see kernel/recovery.ts). */
export interface SuggestedAction {
  label: string;
  commandType?: string;
  payload?: Record<string, unknown>;
  href?: string;
}

/**
 * Map server-suggested actions to toast recovery actions. Command actions
 * re-run through the kernel via `run`; navigation actions change location;
 * `__reload__` reloads; bare labels (e.g. "Ask a manager") explain instead.
 */
export function suggestedToRecovery(
  actions: SuggestedAction[] | undefined,
  run: (commandType: string, payload: Record<string, unknown>) => Promise<{ success: boolean; error?: { message?: string } }>,
  notifyError: (kind: "success" | "error" | "info", message: string, desc?: string) => void,
): RecoveryAction[] {
  if (!actions || actions.length === 0) return [];
  return actions.slice(0, 3).map((a) => {
    if (a.commandType) {
      const commandType = a.commandType;
      const payload = a.payload ?? {};
      return {
        label: a.label,
        run: () => {
          void run(commandType, payload).then((r) => {
            if (r.success) notifyError("success", a.label);
            else notifyError("error", a.label, r.error?.message ?? "Still rejected");
          });
        },
      };
    }
    if (a.href === "__reload__") {
      return { label: a.label, run: () => { window.location.reload(); } };
    }
    if (a.href) {
      const href = a.href;
      return { label: a.label, run: () => { window.location.href = href; } };
    }
    return { label: a.label, run: () => { toast.info(a.label, { description: "This action needs a manager override." }); } };
  });
}

/** Kernel rejection with guided recovery: renders action buttons in the toast. */
export function notifyWithActions(message: string, desc: string | undefined, actions: RecoveryAction[]) {
  playTone("error");
  haptic([30, 40, 30]);
  const [first, ...rest] = actions;
  toast.error(message, {
    description: desc,
    duration: 8000,
    action: first ? { label: first.label, onClick: () => void first.run() } : undefined,
  });
  for (const a of rest) {
    toast.info(message, {
      description: desc,
      duration: 8000,
      action: { label: a.label, onClick: () => void a.run() },
    });
  }
}

export function useFeedback() {
  const last = useRef(0);
  const notify = useCallback((kind: "success" | "error" | "info", message: string, desc?: string) => {
    const now = Date.now();
    if (now - last.current < 250) return;
    last.current = now;
    if (kind === "success") { playTone("success"); haptic(12); toast.success(message, { description: desc }); }
    else if (kind === "error") { playTone("error"); haptic([30, 40, 30]); toast.error(message, { description: desc }); }
    else { playTone("tap"); toast(message, { description: desc }); }
  }, []);
  /** Kernel rejection with guided recovery: renders action buttons in the toast. */
  const notifyWithActionsCb = useCallback((message: string, desc: string | undefined, actions: RecoveryAction[]) => {
    notifyWithActions(message, desc, actions);
  }, []);
  const tap = useCallback(() => { playTone("tap"); haptic(8); }, []);
  return { notify, notifyWithActions: notifyWithActionsCb, tap, playTone, haptic };
}

function go(href: string): RecoveryAction {
  return { label: href.includes("/tables") ? "View tables" : href.includes("/menu") ? "Open menu" : href.includes("/inventory") ? "Open inventory" : "View orders", run: () => { window.location.href = href; } };
}

/** Maps common kernel rejection codes to staff-actionable next steps. */
export function recoveryActionsFor(code: string | undefined, _ctx?: { run: (t: string, p: Record<string, unknown>) => Promise<unknown> }): RecoveryAction[] {
  switch (code) {
    case "TABLE_NOT_AVAILABLE":
    case "TABLE_OCCUPIED":
      return [{ label: "Show available tables", run: () => { window.location.href = "/dashboard/tables"; } }];
    case "TABLE_NOT_FOUND":
      return [{ label: "Show all tables", run: () => { window.location.href = "/dashboard/tables"; } }];
    case "MENU_ITEM_UNAVAILABLE":
      return [{ label: "Open menu availability", run: () => { window.location.href = "/dashboard/menu"; } }];
    case "INSUFFICIENT_STOCK":
      return [{ label: "Open inventory", run: () => { window.location.href = "/dashboard/inventory"; } }];
    case "ORDER_NOT_EDITABLE":
      return [go("/dashboard/orders")];
    case "VERSION_CONFLICT":
      return [
        { label: "Reload latest", run: () => { window.location.reload(); } },
        go("/dashboard/orders"),
      ];
    case "FORBIDDEN":
      return [{ label: "Ask a manager", run: () => { toast.info("Ask a manager", { description: "This action needs a manager override." }); } }];
    case "ORDER_UNPAID":
      return [{ label: "Collect payment", run: () => { window.location.href = "/dashboard/orders"; } }];
    case "INVALID_PAYMENT":
      return [{ label: "Review payment", run: () => { window.location.href = "/dashboard/orders"; } }];
    default:
      return [];
  }
}
