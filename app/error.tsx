"use client";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center pos-fade-in" role="alert">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-7 w-7" /></div>
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">{error?.message || "This section failed to load. Your unsent orders are kept locally."}</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>Dashboard</Button>
      </div>
    </div>
  );
}
