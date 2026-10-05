"use client"

import { useCallback } from "react"
import { useCommand } from "@/kernel/react/kernel-provider"
import { useConflict, type ConflictData, type ConflictField } from "@/components/conflict/conflict-resolution"
import { useFeedback } from "@/lib/feedback"
import type { AttributeBag } from "@/kernel/types"

interface UseConflictResolutionOptions<T> {
  entityType: string
  entityId: string
  getLocalData: () => T
  getServerData: () => Promise<T>
  mapToFields: (local: T, server: T) => ConflictField[]
  commandType: string
  buildCommandPayload: (mergedData: T) => AttributeBag
}

export function useConflictResolution<T>({
  entityType,
  entityId,
  getLocalData,
  getServerData,
  mapToFields,
  commandType,
  buildCommandPayload,
}: UseConflictResolutionOptions<T>) {
  const { run } = useCommand()
  const { openConflict } = useConflict()
  const { notify } = useFeedback()

  const executeWithConflictResolution = useCallback(
    async (payload: AttributeBag): Promise<{ success: boolean; error?: string }> => {
      const result = await run(commandType, payload, {
        onConflict: async (conflictError) => {
          notify("info", "Concurrent edit detected", "Another user modified this record")

          const localData = getLocalData()
          const serverData = await getServerData()

          const fields = mapToFields(localData, serverData)

          const conflictData: ConflictData<T> = {
            entityType,
            entityId,
            localVersion: conflictError.currentVersion - 1,
            serverVersion: conflictError.currentVersion,
            localData,
            serverData,
            fields,
          }

          const action = await openConflict(conflictData)

          if (action.type === "cancel") {
            return "abort"
          }

          if (action.type === "merge" && action.mergedData) {
            // Retry with merged data - run() will handle the retry internally
            buildCommandPayload(action.mergedData as T)
            return "retry"
          }

          if (action.type === "overwrite") {
            // Force overwrite by retrying with local data
            return "retry"
          }

          return "abort"
        },
      })

      if (!result.success) {
        return { success: false, error: result.error?.message }
      }

      return { success: true }
    },
    [run, entityType, entityId, getLocalData, getServerData, mapToFields, commandType, buildCommandPayload, openConflict, notify],
  )

  return { executeWithConflictResolution }
}