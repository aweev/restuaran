import { type NextRequest, NextResponse } from "next/server"
import { compare, hash } from "bcrypt"
import { one, sqlWrite, audit } from "@/lib/db-helpers"
import { getTokenFromRequest, verifyAccessToken } from "@/lib/jwt"
import { z } from "zod"

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "New password must be different from the current one",
    path: ["newPassword"],
  })

export async function POST(req: NextRequest) {
  try {
    // AuthContext already sends the bearer token on this call.
    const token = getTokenFromRequest(req)
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const payload = await verifyAccessToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })

    const v = schema.parse(await req.json())

    const user = await one<{ id: string; password: string }>(
      `SELECT id, password FROM "User" WHERE id = $1 AND "isActive" = TRUE`,
      [payload.sub],
    )
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 })

    // Always verify the current password — a stolen session token must not be
    // enough to take the account over.
    if (!(await compare(v.currentPassword, user.password))) {
      await audit({
        userId: user.id,
        action: "PASSWORD_CHANGE_FAILED",
        entity: "USER",
        entityId: user.id,
        details: {},
      })
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
    }

    const passwordHash = await hash(v.newPassword, 10)
    await sqlWrite(
      `UPDATE "User" SET password = $2, "updatedAt" = NOW() WHERE id = $1`,
      [user.id, passwordHash],
    )

    await audit({
      userId: user.id,
      action: "PASSWORD_CHANGE",
      entity: "USER",
      entityId: user.id,
      details: {},
    })

    return NextResponse.json({ success: true, message: "Password updated." })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request", details: error.errors },
        { status: 400 },
      )
    }
    console.error("[auth] change-password failed:", error)
    return NextResponse.json({ error: "Unable to change password" }, { status: 500 })
  }
}
