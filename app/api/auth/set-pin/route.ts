import { type NextRequest, NextResponse } from "next/server"
import { sqlWrite, audit } from "@/lib/db-helpers"
import { getTokenFromRequest, verifyAccessToken } from "@/lib/jwt"
import { hash } from "bcrypt"
import { z } from "zod"

const schema = z.object({
  userId: z.string().min(1),
  /** 4–6 digits, or empty string to clear the PIN. */
  pin: z.string().regex(/^(\d{4,6})?$/, "PIN must be 4–6 digits"),
})

const MANAGERS = new Set(["admin", "manager", "owner"])

/**
 * Set or clear a staff PIN. Managers only (shared devices: the manager owns
 * credential hygiene). PINs are bcrypt-hashed; setting one resets attempts
 * and lockout. Clearing (pin: "") removes fast-login for that account.
 */
export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req)
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const caller = await verifyAccessToken(token)
    if (!caller) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    if (!MANAGERS.has(String(caller.role ?? ""))) {
      return NextResponse.json({ error: "Managers only" }, { status: 403 })
    }

    const { userId, pin } = schema.parse(await req.json())
    if (pin) {
      const pinHash = await hash(pin, 10)
      await sqlWrite(
        `UPDATE "User" SET "pinHash" = $2, "pinAttempts" = 0, "pinLockedUntil" = NULL, "updatedAt" = NOW() WHERE id = $1 AND "isActive" = TRUE`,
        [userId, pinHash],
      )
    } else {
      await sqlWrite(
        `UPDATE "User" SET "pinHash" = NULL, "pinAttempts" = 0, "pinLockedUntil" = NULL, "updatedAt" = NOW() WHERE id = $1`,
        [userId],
      )
    }
    await audit({
      userId: String(caller.sub ?? ""),
      action: pin ? "PIN_SET" : "PIN_CLEARED",
      entity: "USER",
      entityId: userId,
      details: { by: caller.email ?? caller.sub },
    })
    return NextResponse.json({ success: true, pinSet: Boolean(pin) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[auth] set-pin failed:", error)
    return NextResponse.json({ error: "Unable to update PIN" }, { status: 500 })
  }
}
