import { type NextRequest, NextResponse } from "next/server"
import { one, sqlWrite, toNum, toIso } from "@/lib/db-helpers"
import { z } from "zod"

const signupSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(1),
  name: z.string().min(1).optional(),
  tableNumber: z.string().optional(),
})

const WELCOME_POINTS = 100

export async function POST(req: NextRequest) {
  try {
    const v = signupSchema.parse(await req.json())
    const email = v.email.toLowerCase().trim()

    const existing = await one(
      `SELECT id FROM "LoyaltyCustomer" WHERE LOWER(email) = LOWER($1) OR phone = $2`,
      [email, v.phone],
    )
    if (existing) {
      return NextResponse.json({ error: "Customer already exists" }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const displayName = v.name?.trim() || email.split("@")[0] || "Guest"

    // Member row and the welcome-points ledger entry belong together.
    await sqlWrite("BEGIN")
    let customer: Record<string, unknown> = {}
    try {
      const rows = await sqlWrite(
        `INSERT INTO "LoyaltyCustomer"
           (id, email, phone, name, points, tier, "joinDate", "lastActivity", "totalSpent", "visitsCount")
         VALUES ($1,$2,$3,$4,$5,'bronze',NOW(),NOW(),0,1)
         RETURNING *`,
        [id, email, v.phone, displayName, WELCOME_POINTS],
      )
      customer = rows[0] ?? {}

      await sqlWrite(
        `INSERT INTO "LoyaltyActivity" (id, "customerId", type, points, description, timestamp)
         VALUES ($1,$2,'welcome',$3,'Welcome bonus',NOW())`,
        [crypto.randomUUID(), id, WELCOME_POINTS],
      )
      await sqlWrite("COMMIT")
    } catch (txErr) {
      await sqlWrite("ROLLBACK").catch(() => undefined)
      throw txErr
    }

    return NextResponse.json({
      customer: {
        ...customer,
        points: toNum(customer.points),
        totalSpent: toNum(customer.totalSpent),
        visitsCount: toNum(customer.visitsCount),
        joinDate: toIso(customer.joinDate),
        lastActivity: toIso(customer.lastActivity),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[loyalty] signup failed:", error)
    return NextResponse.json({ error: "Failed to sign up" }, { status: 500 })
  }
}

