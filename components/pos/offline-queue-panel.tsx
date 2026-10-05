"use client";

import { useKernel } from "@/kernel/react/kernel-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/pos/ui-states";
import { Inbox } from "lucide-react";

export function OfflineQueuePanel({ compact = false }: { compact?: boolean }) {
  const { queue, discardQueued, retryQueued, connection, pendingCount } = useKernel();

  if (queue.length === 0) {
    return compact ? (
      <Badge variant="outline">Queue empty · {connection}</Badge>
    ) : (
      <EmptyState
        icon={<Inbox className="h-6 w-6" />}
        title="Offline queue is empty"
        hint={`Connection: ${connection}. Every command accepted while offline will appear here with Retry / Discard.`}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">
          Offline queue · {pendingCount} pending ({connection})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {queue.map((cmd) => (
          <div
            key={cmd.requestId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-medium">{cmd.commandType}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(cmd.enqueuedAt).toLocaleString()} · {cmd.attempts} attempts ·{" "}
                {cmd.requestId.slice(0, 8)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void retryQueued(cmd.requestId)}>
                Retry
              </Button>
              <Button size="sm" variant="ghost" onClick={() => discardQueued(cmd.requestId)}>
                Discard
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
