"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { Order, OrderStatus, CartItem, DiningMode, Payment, Table, PaymentMethod } from "@/types"
import { useAuth } from "./AuthContext"
import { useCommand, useProjection, useKernel, newRequestId } from "@/kernel/react/kernel-provider"
import type { OrderBoardState } from "@/kernel/projections/orders-board"
import { orderRowsToOrders } from "@/lib/kernel-mappers"
import { useFeedback, notifyWithActions, recoveryActionsFor, suggestedToRecovery, type SuggestedAction } from "@/lib/feedback"
import { useAttentionOptional } from "@/context/AttentionContext"
import { ConflictDialog, conflictVersions } from "@/components/pos/conflict-dialog"

interface OrderContextType {
  state: {
    orders: Order[]
    activeOrders: Order[]
    completedOrders: Order[]
    myOrders: Order[]
    loading: boolean
    error: string | null
    selectedOrder: Order | null
  }
  orders: Order[]
  activeOrders: Order[]
  completedOrders: Order[]
  myOrders: Order[]
  loading: boolean
  error: string | null
  selectedOrder: Order | null
  fetchOrders: () => Promise<void>
  selectOrder: (order: Order | null) => void
   createOrder: (
     items: CartItem[],
     tableId: string | null,
     customerName: string | null,
     diningMode: DiningMode,
     serverId: string,
     subtotal: number,
     discount: number,
     total: number,
     notes?: string,
   ) => Promise<Order>
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>
  addPayment: (orderId: string, payment: Payment) => Promise<void>
  updateOrderItems: (orderId: string, items: CartItem[]) => Promise<void>
  updateOrderNotes: (orderId: string, notes: string) => Promise<void>
  cancelOrder: (orderId: string, reason?: string) => Promise<void>
  refundOrder: (orderId: string, amount: number, reason: string) => Promise<void>
  mergeOrders: (targetTable: Table, sourceTableIds: string[]) => Promise<number>
  transferOrderTable: (sourceTableId: string, targetTable: Table) => Promise<number>
}

const OrderContext = createContext<OrderContextType | undefined>(undefined)

/**
 * Orders, backed entirely by the event store.
 *
 * Reads come from the `orders.board` projection (kernel-created tickets: lines,
 * money, kitchen status). Writes go through kernel commands — `order.create` +
 * `order.addLine`, `order.sendToKitchen`, `order.recordPayment`/`order.close`,
 * `order.void`, `order.transferLines`, `order.setNotes`, `order.setTable` —
 * so cross-module guards (86'd policy) and the audit trail apply.
 *
 * The public interface is unchanged, so every consumer keeps working.
 */
export const OrderProvider = ({ children }: { children: ReactNode }) => {
  const { state: authState } = useAuth()
  const { state: board } = useProjection<OrderBoardState>("orders.board", 4000)
  const { run } = useCommand()
  const { ask } = useKernel()
  const { notify } = useFeedback()
  const attention = useAttentionOptional()
  const [selected, setSelected] = useState<Order | null>(null)
  const [conflict, setConflict] = useState<{
    open: boolean;
    commandType: string;
    payload: Record<string, unknown>;
    message?: string;
    currentVersion?: number;
    expectedVersion?: number;
    serverSummary?: string;
  } | null>(null)

  const kernelOrders = useMemo(() => orderRowsToOrders(board?.rows ?? []), [board])
  const myOrders = useMemo(() => {
    const uid = authState.user?.id;
    if (!uid) return [];
    return kernelOrders.filter((o) => o.serverId === uid);
  }, [kernelOrders, authState.user?.id])

  const state = useMemo(() => ({
    orders: kernelOrders,
    activeOrders: kernelOrders.filter(o => ["pending", "preparing", "ready", "delivered"].includes(o.status)),
    completedOrders: kernelOrders.filter(o => ["completed", "cancelled"].includes(o.status)),
    myOrders,
    loading: board === null,
    error: null,
    selectedOrder: selected,
  }), [kernelOrders, myOrders, board, selected])

  const reject = (title: string, err?: { message?: string; code?: string }, commandType?: string, payload?: Record<string, unknown>, serverActions?: SuggestedAction[]) => {
    const code = err?.code;
    const msg = err?.message;
    // Prefer server-suggested command-carrying actions; fall back to the
    // legacy client-side navigation map.
    const fromServer = suggestedToRecovery(serverActions, run, notify);
    const base = fromServer.length > 0 ? fromServer : recoveryActionsFor(code);
    const actions = code === "VERSION_CONFLICT" && commandType && payload
      ? [
          { label: "Retry", run: () => { void run(commandType, payload); } },
          { label: "Reload", run: () => { window.location.reload(); } },
          ...base,
        ]
      : base;
    attention?.push({ title, message: msg, code, href: "/dashboard/orders" });
    if (actions.length > 0) notifyWithActions(title, msg, actions);
    else notify("error", title, msg);
  };

  /**
   * Run a single command with conflict-dialog handling: on VERSION_CONFLICT
   * the dialog opens (with a live server summary) instead of a bare toast.
   * Callers must still skip their own rejection toast for VERSION_CONFLICT —
   * the dialog owns that case.
   */
  const runWithConflict = async (
    commandType: string,
    payload: Record<string, unknown>,
  ) => {
    const result = await run(commandType, payload, {
      onConflict: async (err) => {
        const versions = conflictVersions(err);
        // Show what the record looks like *now* so retry-vs-reload is an
        // informed choice, not a guess.
        let serverSummary: string | undefined;
        const oid = payload.orderId;
        if (typeof oid === "string") {
          try {
            const view = await ask<{ state: { status?: string; lines?: unknown[] } }>("get.order", { orderId: oid });
            if (view.success) {
              const n = Array.isArray(view.data.state.lines) ? view.data.state.lines.length : 0;
              serverSummary = `Latest: ${String(view.data.state.status ?? "unknown")} · ${n} line${n === 1 ? "" : "s"}`;
            }
          } catch {
            /* advisory only */
          }
        }
        setConflict({
          open: true,
          commandType,
          payload,
          message: err.message,
          currentVersion: versions.currentVersion,
          expectedVersion: versions.expectedVersion,
          serverSummary,
        });
        return "abort";
      },
    })
    return result
  }

  const mergeOrdersFn = async (targetTable: Table, sourceTableIds: string[]): Promise<number> => {
    if (sourceTableIds.length === 0) return 0

    const activeStatuses: OrderStatus[] = ["pending", "preparing", "ready", "delivered"]
    const toMove = state.orders.filter(
      (order) => order.tableId !== null && sourceTableIds.includes(order.tableId) && activeStatuses.includes(order.status),
    )

    if (toMove.length === 0) return 0

    for (const order of toMove) {
      const lineIds = order.items.map((i) => i.id)
      if (lineIds.length === 0) continue
      try {
        const dest = state.orders.find(
          (o) => o.tableId === targetTable.id && activeStatuses.includes(o.status),
        )
        let destId = dest?.id
        if (!destId) {
          const created = await run("order.create", {
            tableId: targetTable.id,
            serverId: order.serverId,
            dinerName: order.customerName ?? undefined,
          })
          if (!created.success) continue
          destId = created.aggregateId ?? newRequestId()
        }
        await run("order.transferLines", {
          orderId: order.id,
          toOrderId: destId,
          lineIds,
          transferId: `merge-${order.id}-${destId}`,
        })
      } catch {
        /* per-order best-effort */
      }
    }

    return toMove.length
  }

  const fetchOrders = async () => {
    // No-op: projection refreshes automatically
  }

  const handleConflictRetry = async () => {
    if (!conflict) return;
    const result = await run(conflict.commandType, conflict.payload);
    if (result.success) {
      notify("success", "Retry succeeded");
      setConflict(null);
    } else if (result.error?.code === "VERSION_CONFLICT") {
      // Still conflicted: keep the dialog open with fresh versions.
      const versions = conflictVersions(result.error);
      setConflict({
        ...conflict,
        message: result.error.message,
        currentVersion: versions.currentVersion,
        expectedVersion: versions.expectedVersion,
      });
    } else {
      setConflict(null);
      reject("Order update rejected", result.error, conflict.commandType, conflict.payload, (result as { suggestedActions?: SuggestedAction[] }).suggestedActions);
    }
  };

  const handleConflictReload = () => {
    window.location.reload();
  };

  const handleConflictClose = () => {
    setConflict(null);
  };

  const api = useMemo<OrderContextType>(
    () => ({
      state,
      orders: state.orders,
      activeOrders: state.activeOrders,
      completedOrders: state.completedOrders,
      myOrders: state.myOrders,
      loading: state.loading,
      error: state.error,
      selectedOrder: state.selectedOrder,
      fetchOrders,
      selectOrder: setSelected,

      createOrder: async (
        items: CartItem[],
        tableId: string | null,
        customerName: string | null,
        diningMode: DiningMode,
        serverId: string,
        subtotal: number,
        discount: number,
        total: number,
        notes?: string,
      ): Promise<Order> => {
        const orderId = newRequestId()
        try {
          const created = await run("order.create", {
            orderId,
            channel: diningMode === "Dine in" ? "pos" : diningMode === "Take Away" ? "takeaway" : "delivery",
            tableId: tableId ?? undefined,
            serverId,
            dinerName: customerName ?? undefined,
          })
          if (!created.success) throw new Error(created.error?.message ?? "Order create rejected")

          for (const item of items) {
            const line = await run("order.addLine", {
              orderId,
              menuItemId: item.menuItemId,
              name: item.title,
              unitPrice: item.price,
              quantity: item.quantity,
              modifiers: (item.modifiers ?? []).map((m) => ({ name: m.modifierId, price: 0 })),
            })
            if (!line.success) {
              reject(`Could not add ${item.title}`, line.error, "order.addLine", { orderId })
              throw new Error(line.error?.message ?? `Failed to add ${item.title}`)
            }
          }
          if (discount > 0) {
            await run("order.applyDiscount", { orderId, kind: "amount", value: discount })
          }

          const now = new Date().toISOString()
          const kernelOrder: Order = {
            id: orderId,
            tableId,
            table: { id: tableId ?? "", number: tableId ?? "", capacity: 0, status: "occupied" } as Table,
            customerName,
            items,
            quantity: items.reduce((s, i) => s + i.quantity, 0),
            status: "pending",
            createdAt: now,
            updatedAt: now,
            subtotal,
            tax: 0,
            discount,
            total,
            payments: [],
            isPaid: false,
            diningMode,
            serverId,
            notes,
          }
          setSelected(kernelOrder)
          notify("success", "Order created")
          return kernelOrder
        } catch (error) {
          throw error instanceof Error ? error : new Error("Failed to create order")
        }
      },

      updateOrderStatus: async (orderId: string, status: OrderStatus) => {
        try {
          let result
          if (status === "completed") {
            result = await run("order.close", { orderId })
          } else if (status === "cancelled") {
            result = await run("order.void", { orderId, reason: "cancelled from POS" })
          } else if (status === "preparing" || status === "pending") {
            result = await run("order.sendToKitchen", { orderId })
          } else if (status === "ready" || status === "served" || status === "delivered") {
            result = await run("order.sendToKitchen", { orderId })
          } else {
            result = { success: true } as unknown as typeof result
          }
          if (result && !(result as { success: boolean }).success) {
            const err = (result as { error?: { message?: string; code?: string } }).error;
            reject("Status update failed", err, "order.close", { orderId });
            throw new Error(err?.message ?? "Status update rejected")
          }
          return Promise.resolve()
        } catch (error) {
          if (error instanceof Error && error.message !== "Status update rejected") reject("Status update failed", { message: error.message }, "order.close", { orderId });
          return Promise.reject(error instanceof Error ? error.message : "Failed to update order status")
        }
      },

      addPayment: async (orderId: string, payment: Payment) => {
        try {
          // Card payments (credit/debit) go through authorize → capture flow
          const cardMethods: PaymentMethod[] = ["credit", "debit"]
          if (cardMethods.includes(payment.method)) {
            const auth = await run("payment.authorize", {
              orderId,
              amount: payment.amount,
              method: payment.method,
              gateway: payment.gateway,
              ...(payment.paymentMethodId ? { paymentMethodId: payment.paymentMethodId } : {}),
            })
            if (!auth.success) {
              reject("Payment authorization failed", auth.error, "payment.authorize", { orderId })
              throw new Error(auth.error?.message ?? "Payment authorization failed")
            }
            const paymentId = auth.aggregateId ?? auth.commandId
            if (paymentId) {
              const cap = await run("payment.capture", { paymentId })
              if (!cap.success) {
                reject("Payment capture failed", cap.error, "payment.capture", { orderId })
                throw new Error(cap.error?.message ?? "Payment capture failed")
              }
            }
          }
          const result = await run("order.recordPayment", {
            orderId,
            method: payment.method,
            amount: payment.amount,
            gateway: payment.gateway,
            ...(payment.tip ? { tip: payment.tip } : {}),
          })
          if (!result.success) {
            reject("Payment rejected", result.error, "order.recordPayment", { orderId }, (result as { suggestedActions?: SuggestedAction[] }).suggestedActions)
            throw new Error(result.error?.message ?? "Payment rejected")
          }
          // Auto-close when fully paid: close is a separate, audited command
          // (ORDER_UNPAID if partial — ignored, the balance stays open).
          const closed = await run("order.close", { orderId })
          if (closed.success) notify("success", "Paid — check closed")
          return Promise.resolve()
        } catch (error) {
          return Promise.reject(error instanceof Error ? error.message : "Failed to add payment")
        }
      },

      updateOrderItems: async (orderId: string, items: CartItem[]) => {
        try {
          const current = state.orders.find((o) => o.id === orderId)
          const currentIds = new Set((current?.items ?? []).map((i) => i.id))
          const nextIds = new Set(items.map((i) => i.id))
            for (const id of currentIds) {
            if (!nextIds.has(id)) {
              const res = await run("order.voidLine", { orderId, lineId: id, reason: "removed from POS" })
              if (!res.success) { reject("Order edit rejected", res.error, "order.voidLine", { orderId, lineId: id }, (res as { suggestedActions?: SuggestedAction[] }).suggestedActions); throw new Error(res.error?.message ?? "Line void rejected"); }
            }
          }
          for (const item of items) {
            if (!currentIds.has(item.id)) {
              const res = await run("order.addLine", {
                orderId,
                menuItemId: item.menuItemId,
                name: item.title,
                unitPrice: item.price,
                quantity: item.quantity,
              })
              if (!res.success) { reject(`Could not add ${item.title}`, res.error, "order.addLine", { orderId }, (res as { suggestedActions?: SuggestedAction[] }).suggestedActions); throw new Error(res.error?.message ?? `Failed to add ${item.title}`); }
            }
          }
          return Promise.resolve()
        } catch (error) {
          return Promise.reject(error instanceof Error ? error.message : "Failed to update order items")
        }
      },

      updateOrderNotes: async (orderId: string, notes: string) => {
        try {
          const result = await runWithConflict("order.setNotes", { orderId, notes })
          if (!result.success) {
            if (result.error?.code === "VERSION_CONFLICT") throw new Error(result.error?.message ?? "Order changed by another device");
            reject("Notes update failed", result.error, "order.setNotes", { orderId }, (result as { suggestedActions?: SuggestedAction[] }).suggestedActions); throw new Error(result.error?.message ?? "Notes update rejected");
          }
          return Promise.resolve()
        } catch (error) {
          return Promise.reject(error instanceof Error ? error.message : "Failed to update order notes")
        }
      },

      cancelOrder: async (orderId: string, reason?: string) => {
        try {
          const r = (reason ?? "").trim() || "cancelled from POS"
          const result = await runWithConflict("order.void", { orderId, reason: r })
          if (!result.success) {
            if (result.error?.code === "VERSION_CONFLICT") throw new Error(result.error?.message ?? "Order changed by another device");
            reject("Cancel failed", result.error, "order.void", { orderId }, (result as { suggestedActions?: SuggestedAction[] }).suggestedActions); throw new Error(result.error?.message ?? "Cancel rejected");
          }
          notify("success", "Order cancelled")
          return Promise.resolve()
        } catch (error) {
          return Promise.reject(error instanceof Error ? error.message : "Failed to cancel order")
        }
      },

      // Cash refund for a settled order: pays out of the OPEN drawer session
      // with the order id in the reason, so the money-out is audited against
      // the drawer. Requires order:pay (cash.payout) — managers/cashiers only.
      refundOrder: async (orderId: string, amount: number, reason: string) => {
        try {
          const r = reason.trim()
          if (!Number.isFinite(amount) || amount <= 0) throw new Error("Refund amount must be positive")
          if (!r) throw new Error("A refund reason is required")
          // Open session via the cash.board projection (server truth).
          const res = await fetch("/api/kernel?projection=cash.board", { credentials: "include" }).then((x) => x.json()).catch(() => null)
          const currentId = res?.state?.currentId as string | undefined
          if (!currentId) throw new Error("Open the cash drawer first — refunds pay out of the drawer")
          const result = await run("cash.payout", {
            sessionId: currentId,
            amount,
            reason: `refund ${orderId}: ${r}`,
          })
          if (!result.success) throw new Error(result.error?.message ?? "Refund rejected")
          notify("success", "Refund recorded", `Paid out $${amount.toFixed(2)} from drawer`)
          return Promise.resolve()
        } catch (error) {
          return Promise.reject(error instanceof Error ? error.message : "Failed to record refund")
        }
      },

      mergeOrders: mergeOrdersFn,

      transferOrderTable: async (sourceTableId: string, targetTable: Table): Promise<number> =>
        mergeOrdersFn(targetTable, [sourceTableId]),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, run, notify],
  )

  return (
    <>
      <OrderContext.Provider value={api}>{children}</OrderContext.Provider>
      {conflict && (
        <ConflictDialog
          open={conflict.open}
          message={conflict.message}
          currentVersion={conflict.currentVersion}
          expectedVersion={conflict.expectedVersion}
          serverSummary={conflict.serverSummary}
          onRetry={handleConflictRetry}
          onReload={handleConflictReload}
          onClose={handleConflictClose}
        />
      )}
    </>
  )
}

// Custom hook
export const useOrder = () => {
  const context = useContext(OrderContext)
  if (context === undefined) {
    throw new Error("useOrder must be used within an OrderProvider")
  }
  return context
}