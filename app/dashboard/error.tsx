"use client";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center" role="alert">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-6 w-6" /></div>
      <h2 className="text-xl font-bold">This view failed to load</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{error?.message || "Check connection and retry."}</p>
      <Button size="sm" onClick={reset}>Retry view</Button>
    </div>
  );
}
