import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth-middleware"
import { sqlWrite, audit, toNum, toIso } from "@/lib/db-helpers"
import { z } from "zod"

function shape(row: Record<string, unknown>) {
  return {
    ...row,
    visitCount: toNum(row.visitCount),
    totalSpent: toNum(row.totalSpent),
    lastVisit: toIso(row.lastVisit),
  }
}

export const GET = withAuth(async () => {
  try {
    const rows = await sqlWrite(`SELECT * FROM "Customer" ORDER BY LOWER(name) ASC`)
    return NextResponse.json(rows.map(shape))
  } catch (error) {
    console.error("[customers] list failed:", error)
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 })
  }
})

const createSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  dietaryRestrictions: z.string().optional().nullable(),
  favoriteItems: z.string().optional().nullable(),
  seatingPreferences: z.string().optional().nullable(),
  visitCount: z.number().int().min(0).optional(),
  lastVisit: z.string().datetime().optional().nullable(),
  totalSpent: z.number().min(0).optional(),
})

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const v = createSchema.parse(await req.json())
    const id = crypto.randomUUID()

    const rows = await sqlWrite(
      `INSERT INTO "Customer"
         (id, name, email, phone, notes, allergies, "dietaryRestrictions", "favoriteItems",
          "seatingPreferences", "visitCount", "lastVisit", "totalSpent", "userId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        id, v.name, v.email ?? null, v.phone ?? null, v.notes ?? null, v.allergies ?? null,
        v.dietaryRestrictions ?? null, v.favoriteItems ?? null, v.seatingPreferences ?? null,
        v.visitCount ?? 0, v.lastVisit ? new Date(v.lastVisit) : null, v.totalSpent ?? 0,
        req.user.sub,
      ],
    )

    await audit({
      userId: req.user.sub,
      action: "CREATE",
      entity: "CUSTOMER",
      entityId: id,
      details: { name: v.name, email: v.email },
    })

    return NextResponse.json(shape(rows[0] ?? {}), { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[customers] create failed:", error)
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 })
  }
})

