import { type NextRequest, NextResponse } from "next/server"
import { sqlWrite, toNum, toIso } from "@/lib/db-helpers"
import { z } from "zod"

const loginSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.email || v.phone), {
    message: "Email or phone is required",
  })

/**
 * Loyalty "login" is an identity lookup, not an authentication step — the
 * returned object is the guest's own data, so this endpoint must not be treated
 * as a security boundary by callers.
 */
export async function POST(req: NextRequest) {
  try {
    const v = loginSchema.parse(await req.json())

    const conditions: string[] = []
    const params: unknown[] = []
    if (v.email) {
      params.push(v.email.toLowerCase().trim())
      conditions.push(`LOWER(email) = $${params.length}`)
    }
    if (v.phone) {
      params.push(v.phone)
      conditions.push(`phone = $${params.length}`)
    }

    const customer = await sqlWrite(
      `SELECT * FROM "LoyaltyCustomer" WHERE ${conditions.join(" OR ")} LIMIT 1`,
      params,
    )

    const row = customer[0]
    if (!row) {
      return NextResponse.json({ customer: null })
    }

    await sqlWrite(
      `UPDATE "LoyaltyCustomer" SET "lastActivity" = NOW() WHERE id = $1`,
      [row.id],
    )

    return NextResponse.json({
      customer: {
        ...row,
        points: toNum(row.points),
        totalSpent: toNum(row.totalSpent),
        visitsCount: toNum(row.visitsCount),
        joinDate: toIso(row.joinDate),
        lastActivity: toIso(row.lastActivity),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[loyalty] login failed:", error)
    return NextResponse.json({ error: "Failed to login" }, { status: 500 })
  }
}

