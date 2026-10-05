"use client"

import { useState, useCallback } from "react"
import { createContext, useContext, useMemo, type ReactNode } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, RefreshCw, Copy } from "lucide-react"

export interface ConflictData<T> {
  entityType: string
  entityId: string
  localVersion: number
  serverVersion: number
  localData: T
  serverData: T
  fields: ConflictField[]
}

export interface ConflictField {
  key: string
  label: string
  localValue: unknown
  serverValue: unknown
  type: "text" | "number" | "boolean" | "object"
}

export interface ConflictResolutionAction {
  type: "merge" | "overwrite" | "cancel"
  mergedData?: Record<string, unknown>
}

interface ConflictContextType {
  openConflict: <T>(data: ConflictData<T>) => Promise<ConflictResolutionAction>
  isOpen: boolean
}

const ConflictContext = createContext<ConflictContextType | null>(null)

export function ConflictProvider({ children }: { children: ReactNode }) {
  const [conflict, setConflict] = useState<{
    data: ConflictData<unknown> | null
    resolve: (action: ConflictResolutionAction) => void
  } | null>(null)

  const openConflict = useCallback(<T,>(data: ConflictData<T>): Promise<ConflictResolutionAction> => {
    return new Promise((resolve) => {
      setConflict({ data: data as ConflictData<unknown>, resolve })
    })
  }, [])

  const handleResolve = (action: ConflictResolutionAction) => {
    if (conflict) {
      conflict.resolve(action)
      setConflict(null)
    }
  }

  const value = useMemo(() => ({ openConflict, isOpen: !!conflict }), [openConflict, conflict])

  return (
    <ConflictContext.Provider value={value}>
      {children}
      {conflict && (
        <ConflictDialog
          data={conflict.data!}
          onResolve={handleResolve}
        />
      )}
    </ConflictContext.Provider>
  )
}

export function useConflict() {
  const context = useContext(ConflictContext)
  if (!context) {
    throw new Error("useConflict must be used within a ConflictProvider")
  }
  return context
}

function ConflictDialog({ data, onResolve }: { data: ConflictData<unknown>; onResolve: (action: ConflictResolutionAction) => void }) {
  const [selectedValues, setSelectedValues] = useState<Record<string, "local" | "server">>({})

  const computeDiff = () => {
    return data.fields.map((field) => ({
      ...field,
      hasConflict: JSON.stringify(field.localValue) !== JSON.stringify(field.serverValue),
      selected: selectedValues[field.key] ?? "local",
    }))
  }

  const handleFieldSelect = (key: string, choice: "local" | "server") => {
    setSelectedValues((prev) => ({ ...prev, [key]: choice }))
  }

  const buildMergedData = () => {
    const merged: Record<string, unknown> = {}
    const diff = computeDiff()
    for (const field of diff) {
      const choice = selectedValues[field.key] ?? "local"
      merged[field.key] = choice === "local" ? field.localValue : field.serverValue
    }
    return merged
  }

  const diff = computeDiff()
  const hasConflicts = diff.some((f) => f.hasConflict)

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Concurrent Edit Conflict
          </DialogTitle>
          <DialogDescription>
            <strong>{data.entityType}</strong> <code>{data.entityId}</code> was modified by another user while you were editing.
            Your version: v{data.localVersion} · Server version: v{data.serverVersion}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasConflicts ? (
            <>
              <p className="text-sm text-muted-foreground">
                Choose which value to keep for each conflicting field:
              </p>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {diff.map((field) => (
                  field.hasConflict && (
                    <Card key={field.key} className="border-amber-200 dark:border-amber-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          {field.label}
                          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded">
                            CONFLICT
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`p-3 rounded border ${
                            selectedValues[field.key] === "local" ? "border-primary bg-primary/5" : "border-gray-200 dark:border-gray-700"
                          }`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-muted-foreground">Your version</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleFieldSelect(field.key, "local")}
                                aria-label="Select your version"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <pre className="text-sm font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded max-h-24 overflow-auto">
                              {JSON.stringify(field.localValue, null, 2)}
                            </pre>
                          </div>
                          <div className={`p-3 rounded border ${
                            selectedValues[field.key] === "server" ? "border-primary bg-primary/5" : "border-gray-200 dark:border-gray-700"
                          }`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-muted-foreground">Server version</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleFieldSelect(field.key, "server")}
                                aria-label="Select server version"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <pre className="text-sm font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded max-h-24 overflow-auto">
                              {JSON.stringify(field.serverValue, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                ))}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {diff.filter((f) => f.hasConflict).length} field{diff.filter((f) => f.hasConflict).length !== 1 ? "s" : ""} in conflict
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Select all local
                    const allLocal: Record<string, "local" | "server"> = {}
                    diff.filter((f) => f.hasConflict).forEach((f) => { allLocal[f.key] = "local" })
                    setSelectedValues(allLocal)
                  }}
                  className="text-sm"
                >
                  Keep All Mine
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-green-500" />
              <h3 className="mt-2 text-lg font-medium">No conflicts detected</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The server data matches your local changes. You can safely overwrite.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onResolve({ type: "cancel" })}>Cancel</Button>
          {hasConflicts && (
            <Button variant="outline" onClick={() => onResolve({ type: "merge", mergedData: buildMergedData() })}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Merge & Retry
            </Button>
          )}
          <Button variant="destructive" onClick={() => onResolve({ type: "overwrite" })}>
            Overwrite Server
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}