import { NextResponse } from "next/server"
import { withAuth } from "@/middleware/auth-middleware"
import { sqlWrite, audit, toNum, toIso } from "@/lib/db-helpers"
import { emitToRoom } from "@/lib/socket-registry"
import { z } from "zod"

const STATUSES = ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"] as const

function shape(row: Record<string, unknown>) {
  return {
    ...row,
    partySize: toNum(row.partySize),
    // DATE comes back as a Date; the host stand wants a plain calendar date.
    date: typeof row.date === "string" ? row.date.slice(0, 10) : toIso(row.date)?.slice(0, 10),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

export const GET = withAuth(async () => {
  try {
    const rows = await sqlWrite(`SELECT * FROM "Reservation" ORDER BY date ASC, time ASC`)
    return NextResponse.json(rows.map(shape))
  } catch (error) {
    console.error("[reservations] list failed:", error)
    return NextResponse.json({ error: "Failed to fetch reservations" }, { status: 500 })
  }
})

const createSchema = z.object({
  customerName: z.string().min(1, "Guest name is required"),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  partySize: z.number().int().positive(),
  tableId: z.string().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:MM"),
  status: z.enum(STATUSES).optional(),
  notes: z.string().nullable().optional(),
})

export const POST = withAuth(async (req) => {
  try {
    const v = createSchema.parse(await req.json())
    const id = crypto.randomUUID()

    const rows = await sqlWrite(
      `INSERT INTO "Reservation"
         (id, "customerName", phone, email, "partySize", "tableId", date, time, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8::time,$9::"ReservationStatus",$10)
       RETURNING *`,
      [
        id, v.customerName, v.phone ?? null, v.email ?? null, v.partySize,
        v.tableId ?? null, v.date, v.time, v.status ?? "pending", v.notes ?? null,
      ],
    )

    const created = shape(rows[0] ?? {})

    // Push to the host stand in real time.
    emitToRoom("global", "reservation:new", created)

    await audit({
      userId: req.user.sub,
      action: "CREATE",
      entity: "RESERVATION",
      entityId: id,
      details: { customerName: v.customerName, partySize: v.partySize, time: v.time },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[reservations] create failed:", error)
    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 })
  }
})
