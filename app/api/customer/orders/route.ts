import { type NextRequest, NextResponse } from "next/server"
import { sqlWrite, audit, toNum, many } from "@/lib/db-helpers"
import { getKernel } from "@/kernel/server/kernel-singleton"
import { systemActor } from "@/kernel/tenant/tenant"
import { z } from "zod"

const orderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        menuItemId: z.string(),
        title: z.string(),
        price: z.number(),
        quantity: z.number().int().positive(),
        totalPrice: z.number(),
        type: z.enum(["Veg", "Non Veg"]),
        specialInstructions: z.string().optional().nullable(),
        course: z.number().int().min(1).max(5).optional(),
        modifiers: z
          .array(z.object({ modifierId: z.string(), optionIds: z.array(z.string()) }))
          .optional(),
      }),
    )
    .min(1),
  tableId: z.string().optional().nullable(),
  customerName: z.string().min(1),
  diningMode: z.enum(["Dine in", "Take Away", "Delivery"]),
  // Legacy clients still send these; they are estimates and are ignored for
  // fiscal math. New clients may omit them.
  subtotal: z.number().optional().default(0),
  tax: z.number().optional().default(0),
  total: z.number().optional().default(0),
  notes: z.string().optional().nullable(),
  status: z.enum(["pending", "preparing", "ready", "served", "delivered", "completed", "cancelled"]),
})

const channelFor = (diningMode: string): string =>
  diningMode === "Take Away" ? "takeaway" : diningMode === "Delivery" ? "delivery" : "pos"

/**
 * Public: a guest at the table places their own order.
 *
 * Kernel-first: the order is created via the event-sourced command bus
 * (so 86'd-item vetoes, inventory hooks, KDS projections and audit trail all
 * apply), with server-resolved menu prices and server-side tax. The legacy
 * SQL Order/OrderItem rows are then mirrored best-effort so the existing
 * order-tracking screen keeps working during the migration.
 */
export async function POST(req: NextRequest) {
  try {
    const v = orderSchema.parse(await req.json())
    const orderId = crypto.randomUUID()
    const actor = systemActor({ userId: "system:guest-checkout" })

    // ---- Server-resolve prices (never trust client money) ----
    const menuIds = [...new Set(v.items.map((i) => i.menuItemId))]
    const optionIds = [...new Set(v.items.flatMap((i) => (i.modifiers ?? []).flatMap((m) => m.optionIds)))]
    let menuById = new Map<string, { title: string; price: number; available: boolean }>()
    let optionById = new Map<string, { name: string; price: number }>()
    try {
      const menuRows = menuIds.length
        ? await many<{ id: string; title: string; price: string | number; available: boolean }>(
            `SELECT id, title, price, available FROM "MenuItem" WHERE id = ANY($1)`,
            [menuIds],
          )
        : []
      menuById = new Map(
        menuRows.map((r) => [r.id, { title: r.title, price: Number(r.price), available: r.available }]),
      )
      if (optionIds.length) {
        const optRows = await many<{ id: string; name: string; price: string | number }>(
          `SELECT id, name, price FROM "MenuItemModifierOption" WHERE id = ANY($1)`,
          [optionIds],
        )
        optionById = new Map(optRows.map((r) => [r.id, { name: r.name, price: Number(r.price) }]))
      }
    } catch (dbErr) {
      // Price-table lookup failed (dev without DB?): fall back to client
      // prices rather than refusing service; the drift is audited below.
      console.warn("[customer/orders] menu price lookup failed, using client prices", dbErr)
    }

    for (const item of v.items) {
      const menu = menuById.get(item.menuItemId)
      if (menu && menu.available === false) {
        return NextResponse.json(
          { error: "Item unavailable", code: "MENU_ITEM_UNAVAILABLE", menuItemId: item.menuItemId },
          { status: 409 },
        )
      }
    }

    const kernel = await getKernel()
    const fail = async (code: string, message: string, status = 409) => {
      // Best-effort void so a partially-built order never strands open lines.
      await kernel.execute("order.void", { orderId, reason: `guest-checkout-abort:${code}` }, actor).catch(() => null)
      return NextResponse.json({ error: message, code }, { status })
    }

    // ---- Kernel write path ----
    const created = await kernel.execute(
      "order.create",
      {
        orderId,
        channel: channelFor(v.diningMode),
        tableId: v.tableId || undefined,
        dinerName: v.customerName,
      },
      actor,
    )
    if (!created.success) return fail(created.error?.code ?? "ORDER_CREATE_FAILED", created.error?.message ?? "Could not start order")

    const lineNotes: string[] = []
    for (const item of v.items) {
      const menu = menuById.get(item.menuItemId)
      const unitPrice = menu ? menu.price : item.price
      const modifiers = (item.modifiers ?? []).flatMap((m) =>
        m.optionIds.map((oid) => {
          const opt = optionById.get(oid)
          return opt ? { optionId: oid, name: opt.name, price: opt.price } : { optionId: oid, name: oid, price: 0 }
        }),
      )
      const added = await kernel.execute(
        "order.addLine",
        {
          orderId,
          menuItemId: item.menuItemId,
          name: menu ? menu.title : item.title,
          unitPrice,
          quantity: item.quantity,
          modifiers: modifiers.length ? modifiers : undefined,
          course: item.course ?? undefined,
        },
        actor,
      )
      if (!added.success) return fail(added.error?.code ?? "ADD_LINE_FAILED", added.error?.message ?? "Item rejected")
      if (item.specialInstructions?.trim()) {
        lineNotes.push(`[${menu ? menu.title : item.title} x${item.quantity}] ${item.specialInstructions.trim()}`)
      }
    }

    const combinedNotes = [v.notes?.trim(), ...lineNotes].filter(Boolean).join("\n")
    if (combinedNotes) {
      // OrderLine has no per-line notes field yet; keep instructions at the
      // order level so the KDS ticket carries them. Full fidelity is also in
      // the SQL mirror below.
      await kernel.execute("order.setNotes", { orderId, notes: combinedNotes.slice(0, 2000) }, actor).catch(() => null)
    }

    let taxTotal = 0
    let taxPending = false
    const taxed = await kernel.execute("order.applyTax", { orderId }, actor)
    if (!taxed.success) {
      taxPending = true
      console.warn("[customer/orders] applyTax failed, totals pre-tax", taxed.error)
    }

    const orderView = await kernel.ask("get.order", { orderId }, actor)
    const orderData = (orderView.success ? orderView.data : null) as {
      id: string
      state: { taxTotal?: number }
      total?: number
    } | null
    if (orderView.success && orderData) {
      taxTotal = Number(orderData.state?.taxTotal ?? 0)
    } else {
      taxPending = true
    }
    const authoritativeTotal = orderData && typeof orderData.total === "number"
      ? Number(orderData.total)
      : null

    const fired = await kernel.execute("order.sendToKitchen", { orderId }, actor)
    if (!fired.success) return fail(fired.error?.code ?? "SEND_FAILED", fired.error?.message ?? "Could not fire order")

    // Re-read after fire for the final receipt number.
    let finalTotal = authoritativeTotal
    let finalTax = taxTotal
    const afterFire = await kernel.ask("get.order", { orderId }, actor)
    if (afterFire.success) {
      const afterData = afterFire.data as { state?: { taxTotal?: number }; total?: number } | null
      if (typeof afterData?.total === "number") finalTotal = Number(afterData.total)
      finalTax = Number(afterData?.state?.taxTotal ?? taxTotal)
    }

    // Server subtotal from resolved prices (kernel is truth; recompute for mirror).
    const serverSubtotal = v.items.reduce((s, item) => {
      const menu = menuById.get(item.menuItemId)
      const unit = menu ? menu.price : item.price
      const extras = (item.modifiers ?? []).flatMap((m) => m.optionIds).reduce((acc, oid) => acc + (optionById.get(oid)?.price ?? 0), 0)
      return s + (unit + extras) * item.quantity
    }, 0)
    if (finalTotal == null) finalTotal = serverSubtotal + finalTax

    // ---- Legacy SQL mirror (tracking screen reads SQL until migrated) ----
    let mirrored = true
    try {
      await sqlWrite("BEGIN")
      try {
        await sqlWrite(
          `INSERT INTO "Order"
             (id, "tableId", "customerName", status, "diningMode", subtotal, tax, discount, tip, total,
              "isPaid", notes)
           VALUES ($1,$2,$3,$4::"OrderStatus",$5::"DiningMode",$6,$7,0,0,$8,FALSE,$9)`,
          [orderId, v.tableId || null, v.customerName, v.status, v.diningMode, serverSubtotal, finalTax, finalTotal, combinedNotes || null],
        )
        for (const item of v.items) {
          const menu = menuById.get(item.menuItemId)
          const unit = menu ? menu.price : item.price
          const extras = (item.modifiers ?? []).flatMap((m) => m.optionIds).reduce((acc, oid) => acc + (optionById.get(oid)?.price ?? 0), 0)
          const lineTotal = (unit + extras) * item.quantity
          const itemId = item.id ?? crypto.randomUUID()
          await sqlWrite(
            `INSERT INTO "OrderItem"
               (id, "orderId", "menuItemId", title, price, quantity, "totalPrice",
                "specialInstructions", type, "course", "sentToKitchenAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::"FoodType",$10,NOW())`,
            [itemId, orderId, item.menuItemId, menu ? menu.title : item.title, unit, item.quantity, lineTotal, item.specialInstructions ?? null, item.type, item.course ?? 1],
          )
          for (const mod of item.modifiers ?? []) {
            await sqlWrite(
              `INSERT INTO "ModifierSelection" (id, "orderItemId", "modifierId", "optionIds")
               VALUES ($1,$2,$3,$4::text[])`,
              [crypto.randomUUID(), itemId, mod.modifierId, `{${mod.optionIds.join(",")}}`],
            )
          }
        }
        if (v.tableId && v.diningMode === "Dine in") {
          await kernel
            .execute("table.seat", { tableId: v.tableId, orderId, serverId: "guest" }, actor)
            .catch(() => null)
          await sqlWrite(
            `UPDATE "Table"
               SET status = 'occupied', "customerName" = $2, "startTime" = NOW(), "updatedAt" = NOW()
             WHERE id = $1`,
            [v.tableId, v.customerName],
          )
        }
        await sqlWrite("COMMIT")
      } catch (txErr) {
        await sqlWrite("ROLLBACK").catch(() => undefined)
        throw txErr
      }
    } catch (mirrorErr) {
      mirrored = false
      console.error("[customer/orders] SQL mirror failed, kernel order stands", { orderId, mirrorErr })
    }

    await audit({
      userId: null,
      action: "CREATE",
      entity: "ORDER",
      entityId: orderId,
      details: {
        source: "customer-kernel",
        tableId: v.tableId,
        customerName: v.customerName,
        subtotal: serverSubtotal,
        tax: finalTax,
        total: finalTotal,
        taxPending,
        mirrored,
        clientTotal: v.total,
        itemCount: v.items.length,
      },
    })

    return NextResponse.json(
      { id: orderId, status: v.status, subtotal: toNum(serverSubtotal), tax: toNum(finalTax), total: toNum(finalTotal ?? 0), taxEstimate: taxPending, mirrored },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[customer/orders] create failed:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
