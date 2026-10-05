"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getSetupProgress } from "@/lib/settings";

const STEPS = [
  { key: "venue", label: "Venue profile" },
  { key: "service", label: "Service model" },
  { key: "tax", label: "Tax & currency" },
  { key: "tables", label: "Tables" },
  { key: "menu", label: "Menu starter" },
];

export function SetupChecklist() {
  const { done, pct } = getSetupProgress();
  if (pct >= 100) return null;
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Finish setup — {pct}% complete</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={pct} aria-label={`Setup ${pct}% complete`} />
        <ul className="flex flex-wrap gap-2 text-xs">
          {STEPS.map((s) => (
            <li
              key={s.key}
              className={
                done.includes(s.key)
                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800"
                  : "rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
              }
            >
              {done.includes(s.key) ? "✓ " : ""}{s.label}
            </li>
          ))}
        </ul>
        <Button size="sm" asChild>
          <Link href="/dashboard/setup">Continue setup</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
