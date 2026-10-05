import { NextResponse } from "next/server"
import { withAuth, type RouteContext } from "@/middleware/auth-middleware"
import { one, sqlWrite } from "@/lib/db-helpers"

type Ctx = RouteContext<{ userId: string }>

/** Params come from the context — `req.params` does not exist on a NextRequest. */
export const DELETE = withAuth(async (_req, { params }: Ctx) => {
  try {
    const { userId } = await params

    const existing = await one(`SELECT "userId" FROM "KitchenStaffAssignment" WHERE "userId" = $1`, [userId])
    if (!existing) {
      return NextResponse.json({ error: "Staff assignment not found" }, { status: 404 })
    }

    await sqlWrite(`DELETE FROM "KitchenStaffAssignment" WHERE "userId" = $1`, [userId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[kitchen] staff assignment delete failed:", error)
    return NextResponse.json({ error: "Failed to delete staff assignment" }, { status: 500 })
  }
})

