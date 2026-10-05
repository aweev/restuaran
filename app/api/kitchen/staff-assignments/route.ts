import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/middleware/auth-middleware"
import { one, sqlWrite } from "@/lib/db-helpers"
import { z } from "zod"

const assignmentSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().min(1),
  station: z.string().min(1),
  assignedOrders: z.array(z.string()).optional(),
})

/** Station roster flattened to the `{ userId, userName, station, assignedOrders[] }` shape. */
export const GET = withAuth(async () => {
  try {
    const rows = await sqlWrite(
      `SELECT a."userId", a."userName", a.station,
              COALESCE((
                SELECT json_agg(ao."orderId")
                FROM "AssignedOrder" ao WHERE ao."userId" = a."userId"
              ), '[]'::json) AS "assignedOrders"
         FROM "KitchenStaffAssignment" a
        ORDER BY a.station, a."userName"`,
    )
    return NextResponse.json(
      rows.map((r) => ({
        userId: r.userId,
        userName: r.userName,
        station: r.station,
        assignedOrders: Array.isArray(r.assignedOrders) ? r.assignedOrders : [],
      })),
    )
  } catch (error) {
    console.error("[kitchen] staff assignments fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch staff assignments" }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const v = assignmentSchema.parse(await req.json())

    const user = await one(`SELECT id, name FROM "User" WHERE id = $1`, [v.userId])
    if (!user) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    const rows = await sqlWrite(
      `INSERT INTO "KitchenStaffAssignment" ("userId", "userName", station)
       VALUES ($1, $2, $3)
       ON CONFLICT ("userId")
       DO UPDATE SET "userName" = EXCLUDED."userName", station = EXCLUDED.station
       RETURNING *`,
      [v.userId, v.userName, v.station],
    )

    // Replace the assignment set when the caller supplied one.
    if (v.assignedOrders) {
      await sqlWrite("BEGIN")
      try {
        await sqlWrite(`DELETE FROM "AssignedOrder" WHERE "userId" = $1`, [v.userId])
        for (const orderId of v.assignedOrders) {
          await sqlWrite(
            `INSERT INTO "AssignedOrder" ("userId", "orderId") VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [v.userId, orderId],
          )
        }
        await sqlWrite("COMMIT")
      } catch (txErr) {
        await sqlWrite("ROLLBACK").catch(() => undefined)
        throw txErr
      }
    }

    return NextResponse.json(rows[0] ?? {})
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[kitchen] staff assignment upsert failed:", error)
    return NextResponse.json({ error: "Failed to create/update staff assignment" }, { status: 500 })
  }
})

