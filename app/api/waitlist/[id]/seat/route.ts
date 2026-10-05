import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest, type RouteContext } from "@/middleware/auth-middleware"
import { one, sqlWrite, audit } from "@/lib/db-helpers"
import { z } from "zod"

type Ctx = RouteContext<{ id: string }>

/**
 * Table ids are TEXT ("table-t1"), not UUIDs — the previous
 * `z.string().uuid()` rejected every real table id.
 */
const seatSchema = z.object({ tableId: z.string().min(1, "Invalid table ID") })

export const POST = withAuth(async (req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const validated = seatSchema.parse(await req.json())

    const entry = await one(
      `SELECT id, "customerName", "partySize" FROM "WaitlistEntry" WHERE id = $1`,
      [id],
    )
    if (!entry) return NextResponse.json({ error: "Wait list entry not found" }, { status: 404 })

    const table = await one<{ id: string; number: string; status: string }>(
      `SELECT id, number, status FROM "Table" WHERE id = $1`,
      [validated.tableId],
    )
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 })
    if (table.status !== "available") {
      return NextResponse.json({ error: "Table is not available" }, { status: 400 })
    }

    // Seat with a *conditional* update. Checking status and then updating in two
    // statements leaves a window where two hosts seat the same table; letting
    // Postgres decide inside a single `WHERE status = 'available'` removes it.
    // A zero-row result means someone else won the race.
    const seated = await sqlWrite(
      `UPDATE "Table"
          SET status = 'occupied', "customerName" = $2, "customerCount" = $3,
              "startTime" = NOW(), "serverId" = $4, "updatedAt" = NOW()
        WHERE id = $1 AND status = 'available'
        RETURNING id, number`,
      [table.id, entry.customerName, entry.partySize, req.user.sub],
    )

    if (seated.length === 0) {
      return NextResponse.json(
        { error: "That table was just taken. Pick another one." },
        { status: 409 },
      )
    }

    // Best-effort dequeue. If this fails the party is seated *and* still on the
    // list, which the host can resolve — the reverse (seated but dequeued) would
    // lose the guest entirely, so this ordering is deliberate.
    try {
      await sqlWrite(`DELETE FROM "WaitlistEntry" WHERE id = $1`, [id])
    } catch (err) {
      console.error("[waitlist] seated but failed to dequeue:", err)
    }

    await audit({
      userId: req.user.sub,
      action: "SEAT",
      entity: "WAITLIST",
      entityId: id,
      details: {
        customerName: entry.customerName,
        tableId: table.id,
        tableNumber: seated[0].number,
      },
    })

    return NextResponse.json({ success: true, tableId: table.id, tableNumber: seated[0].number })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[waitlist] seat failed:", error)
    return NextResponse.json({ error: "Failed to seat customer" }, { status: 500 })
  }
})

