import { type NextRequest, NextResponse } from "next/server"
import { compare, hash } from "bcrypt"
import { sqlWrite, audit } from "@/lib/db-helpers"
import { z } from "zod"

const schema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((v) => v.password === v.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

/**
 * Consume a reset token and set a new password.
 *
 * The token is verified by comparing bcrypt hashes across the candidate rows
 * rather than hashing the presented token first, because bcrypt salts differ
 * per row. A consumed token is marked `usedAt` so it cannot be replayed.
 */
export async function POST(req: NextRequest) {
  try {
    const v = schema.parse(await req.json())

    const candidates = (await sqlWrite(
      `SELECT id, "userId", "tokenHash"
         FROM "PasswordResetToken"
        WHERE "usedAt" IS NULL AND "expiresAt" > NOW()`,
    )) as unknown as { id: string; userId: string; tokenHash: string }[]

    let matched: { id: string; userId: string } | null = null
    for (const row of candidates) {
      if (await compare(v.token, row.tokenHash)) {
        matched = { id: row.id, userId: row.userId }
        break
      }
    }

    if (!matched) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 },
      )
    }

    const passwordHash = await hash(v.password, 10)

    await sqlWrite("BEGIN")
    try {
      const claimed = await sqlWrite(
        `UPDATE "PasswordResetToken" SET "usedAt" = NOW()
          WHERE id = $1 AND "usedAt" IS NULL
          RETURNING id`,
        [matched.id],
      )
      if (claimed.length === 0) {
        // Another request consumed it between the lookup and this claim.
        await sqlWrite("ROLLBACK")
        return NextResponse.json(
          { error: "This reset link has already been used." },
          { status: 400 },
        )
      }

      await sqlWrite(
        `UPDATE "User" SET password = $2, "updatedAt" = NOW() WHERE id = $1`,
        [matched.userId, passwordHash],
      )
      // Invalidate every other outstanding token for this account.
      await sqlWrite(
        `UPDATE "PasswordResetToken" SET "usedAt" = NOW()
          WHERE "userId" = $1 AND "usedAt" IS NULL`,
        [matched.userId],
      )
      await sqlWrite("COMMIT")
    } catch (txErr) {
      await sqlWrite("ROLLBACK").catch(() => undefined)
      throw txErr
    }

    await audit({
      userId: matched.userId,
      action: "PASSWORD_RESET",
      entity: "USER",
      entityId: matched.userId,
      details: {},
    })

    return NextResponse.json({ success: true, message: "Password updated. You can sign in now." })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request", details: error.errors },
        { status: 400 },
      )
    }
    console.error("[auth] reset-password failed:", error)
    return NextResponse.json({ error: "Unable to reset password" }, { status: 500 })
  }
}
