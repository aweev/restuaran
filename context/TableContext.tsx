"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Table, TableState, TableStatus } from "@/types";
import { useCommand, useProjection } from "@/kernel/react/kernel-provider";
import type { TableBoardState } from "@/kernel/projections/builtins";
import { tableRowsToTables } from "@/lib/kernel-mappers";
import { useFeedback, notifyWithActions, recoveryActionsFor, suggestedToRecovery, type SuggestedAction } from "@/lib/feedback";
import { useAttentionOptional } from "@/context/AttentionContext";
import { useAuth } from "@/context/AuthContext";

/**
 * Tables, backed by the event store.
 *
 * This previously fetched `/api/tables` and PATCHed it, which meant the floor
 * plan, the reservation board and the waitlist could each disagree the moment
 * two staff touched the same table. The list is now the `tables.board`
 * projection and every action is a command, so the kernel's guards
 * (double-seating, seating onto a reserved table) apply to the UI as well.
 *
 * The public interface is unchanged, so every consumer keeps working.
 */

interface TableContextType {
  state: TableState
  myTables: Table[]
  assignedSection: string | null
  setAssignedSection: (s: string | null) => void
  fetchTables: () => Promise<void>
  selectTable: (table: Table | null) => void
  updateTableStatus: (tableId: string, status: TableStatus) => Promise<void>
  occupyTable: (tableId: string, customerName: string, customerCount: number, serverName: string) => Promise<void>
  reserveTable: (tableId: string, customerName: string, customerCount: number, startTime: string) => Promise<void>
  clearTable: (tableId: string) => Promise<void>
  updateTablePosition: (tableId: string, position: { x: number; y: number }) => Promise<void>
  addTable: (table: Table) => Promise<void>
  removeTable: (tableId: string) => Promise<void>
}

const TableContext = createContext<TableContextType | undefined>(undefined)

export const TableProvider = ({ children }: { children: ReactNode }) => {
  const { state: board } = useProjection<TableBoardState>("tables.board", 1500)
  const { run } = useCommand()
  const { notify } = useFeedback()
  const attention = useAttentionOptional()
  const { state: authState } = useAuth()
  const [selected, setSelected] = useState<Table | null>(null)
  const [assignedSection, setAssignedSection] = useState<string | null>(null)

  const tables = useMemo(() => tableRowsToTables(board?.rows ?? []), [board])
  const serverByTable = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const r of board?.rows ?? []) m[r.tableId] = r.serverId ?? null;
    return m;
  }, [board])
  const zoneByTable = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const r of board?.rows ?? []) m[r.tableId] = (r.zone ?? r.floor ?? null) as string | null;
    return m;
  }, [board])

  const myTables = useMemo(() => {
    const uid = authState.user?.id;
    let list = uid ? tables.filter((t) => serverByTable[t.id] === uid) : [];
    if (assignedSection) list = list.filter((t) => (zoneByTable[t.id] ?? "main") === assignedSection);
    return list;
  }, [tables, serverByTable, zoneByTable, authState.user?.id, assignedSection])

  const state = useMemo<TableState>(
    () => ({
      tables,
      // The projection arriving *is* the load boundary; there is no separate
      // fetch to await, so `loading` is simply "no snapshot yet".
      loading: board === null,
      error: null,
      selectedTable: selected,
    }),
    [tables, board, selected],
  )

  const reject = (title: string, err?: { message?: string; code?: string }, commandType?: string, payload?: Record<string, unknown>, serverActions?: SuggestedAction[]) => {
    const code = err?.code;
    const msg = err?.message;
    const fromServer = suggestedToRecovery(serverActions, run, notify);
    const base = fromServer.length > 0 ? fromServer : recoveryActionsFor(code);
    const actions = code === "VERSION_CONFLICT" && commandType && payload
      ? [
          { label: "Retry", run: () => { void run(commandType, payload); } },
          { label: "Reload", run: () => { window.location.reload(); } },
          ...base,
        ]
      : base;
    attention?.push({ title, message: msg, code, href: "/dashboard/tables" });
    if (actions.length > 0) notifyWithActions(title, msg, actions);
    else notify("error", title, msg);
  };

  /** Run a command and surface any domain rejection as a guided-recovery toast + attention record. */
  const dispatch = async (
    commandType: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ): Promise<boolean> => {
    const result = await run(commandType, payload, {
      onConflict: async (err) => {
        reject("Table changed by another device", err, commandType, payload);
        return "abort";
      },
    })
    if (result.success) notify("success", successMessage)
    else if (result.error?.code !== "VERSION_CONFLICT") reject("Table update rejected", result.error, commandType, payload, (result as { suggestedActions?: SuggestedAction[] }).suggestedActions)
    return result.success
  }


  const api = useMemo<TableContextType>(
    () => ({
      state,
      myTables,
      assignedSection,
      setAssignedSection,
      // Retained for call-site compatibility. The projection refreshes itself,
      // so there is nothing to fetch; resolving immediately keeps any caller
      // that awaits this (and clears its own spinner) working.
      fetchTables: async () => {},
      selectTable: setSelected,

      updateTableStatus: async (tableId, status) => {
        // The kernel models the lifecycle as distinct commands rather than a
        // free-form status write, so an illegal transition is refused here
        // instead of corrupting the board.
        switch (status) {
          case "occupied":
            await dispatch("table.seat", { tableId, orderId: `manual-${tableId}`, serverId: "unassigned" }, "Table occupied")
            return
          case "dirty":
            await dispatch("table.clear", { tableId }, "Table marked for bussing")
            return
          case "available":
            await dispatch("table.clean", { tableId }, "Table ready")
            return
          case "reserved":
            // Reserving without a booking would strand the table, so this
            // routes the host through the reservation flow instead.
            notify("info", "Reserve this table from a reservation so the guest is attached")
            return
        }
      },

      occupyTable: async (tableId, customerName, customerCount, serverName) => {
        await dispatch(
          "table.seat",
          {
            tableId,
            orderId: `walkin-${tableId}`,
            serverId: serverName || "unassigned",
            dinerName: customerName,
            covers: customerCount,
          },
          `${customerName} seated`,
        )
      },

      reserveTable: async (tableId, customerName) => {
        await dispatch(
          "table.reserve",
          { tableId, reservationId: `manual-${tableId}`, customerName },
          "Table reserved",
        )
      },

      clearTable: async (tableId) => {
        await dispatch("table.clear", { tableId }, "Table cleared")
      },

      updateTablePosition: async (tableId, position) => {
        // The floor plan feels dead without a fast round trip, and the
        // projection confirms a moment later. A rejected move surfaces with
        // guided recovery and the next poll restores the truth.
        const result = await run("table.reposition", { tableId, x: position.x, y: position.y })
        if (!result.success) reject("Table move rejected", result.error, "table.reposition", { tableId, x: position.x, y: position.y }, (result as { suggestedActions?: SuggestedAction[] }).suggestedActions)
      },

      addTable: async (table: Table) => {
        await dispatch(
          "table.create",
          {
            tableId: table.id,
            label: table.number,
            capacity: table.capacity,
            x: table.position?.x,
            y: table.position?.y,
          },
          "Table added",
        )
      },

      removeTable: async (tableId) => {
        // There is deliberately no table.delete: floor-plan history is an audit
        // trail, so a table leaves service rather than vanishing.
        await dispatch("table.outOfService", { tableId }, "Table taken out of service")
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, myTables, assignedSection, run, notify],
  )

  return <TableContext.Provider value={api}>{children}</TableContext.Provider>
}

// Custom hook
export const useTable = () => {
  const context = useContext(TableContext)
  if (context === undefined) {
    throw new Error("useTable must be used within a TableProvider")
  }
  return context
}
