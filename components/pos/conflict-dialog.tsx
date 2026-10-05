"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Legacy fallback: extract a version from a kernel VERSION_CONFLICT message.
 * Prefer {@link conflictVersions} — the server now sends structured
 * `details.{expectedVersion,currentVersion}` and the message is display text.
 */
export function parseConflictVersion(message: string | undefined): number {
  if (!message) return 0;
  const m = /expected v(\d+)|version\s+(\d+)|v(\d+)/i.exec(message);
  if (!m) return 0;
  return parseInt(m[1] ?? m[2] ?? m[3] ?? "0", 10) || 0;
}

export interface ConflictVersions {
  expectedVersion: number;
  currentVersion: number;
}

/** Structured versions first, message regex only as a legacy fallback. */
export function conflictVersions(err?: {
  message?: string;
  details?: Record<string, unknown>;
}): ConflictVersions {
  const d = err?.details ?? {};
  const expected =
    typeof d.expectedVersion === "number"
      ? d.expectedVersion
      : parseConflictVersion(err?.message);
  const current =
    typeof d.currentVersion === "number" && d.currentVersion > 0
      ? d.currentVersion
      : parseConflictVersion(err?.message);
  return { expectedVersion: expected, currentVersion: current };
}

interface ConflictDialogProps {
  open: boolean;
  message?: string;
  currentVersion?: number;
  expectedVersion?: number;
  serverSummary?: string;
  onRetry: () => void;
  onReload: () => void;
  onClose: () => void;
}

export function ConflictDialog({ open, message, currentVersion, expectedVersion, serverSummary, onRetry, onReload, onClose }: ConflictDialogProps) {
  const versionLine =
    typeof currentVersion === "number" && currentVersion > 0
      ? typeof expectedVersion === "number" && expectedVersion > 0 && expectedVersion !== currentVersion
        ? ` (yours: v${expectedVersion}, latest: v${currentVersion})`
        : ` (latest: v${currentVersion})`
      : "";
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Someone else changed this</DialogTitle>
          <DialogDescription>
            {message ?? "This record was updated by another device."}
            {versionLine}
            {" "}Keep your change and retry, or reload the latest and start over.
            {serverSummary && (
              <>
                <br />
                <span className="font-medium">{serverSummary}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onReload}>
            Reload latest
          </Button>
          <Button onClick={onRetry}>Keep mine (retry)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
