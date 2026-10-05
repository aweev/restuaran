import { type NextRequest, NextResponse } from "next/server"
import { hash } from "bcrypt"
import { one, sqlWrite, audit } from "@/lib/db-helpers"
import { z } from "zod"

const schema = z.object({ email: z.string().email() })

/** Token lifetime: short enough to be useless if an inbox is compromised. */
const RESET_TTL_MINUTES = 30

/**
 * Password reset request.
 *
 * Always returns 200 with the same body whether or not the address is
 * registered — otherwise this endpoint enumerates valid staff accounts. The
 * token is stored hashed; the plaintext only ever exists in the email.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = schema.parse(await req.json())
    const normalized = email.toLowerCase().trim()

    const user = await one<{ id: string; name: string; email: string }>(
      `SELECT id, name, email FROM "User" WHERE LOWER(email) = $1 AND "isActive" = TRUE`,
      [normalized],
    )

    if (user) {
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")
      const tokenHash = await hash(token, 10)

      await sqlWrite(
        `INSERT INTO "PasswordResetToken"
           (id, "userId", "tokenHash", "expiresAt", "usedAt")
         VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval, NULL)`,
        [crypto.randomUUID(), user.id, tokenHash, String(RESET_TTL_MINUTES)],
      )

      // Dev convenience only. In production this must be handed to a mail
      // transport; logging a reset token to stdout is never acceptable there.
      if (process.env.NODE_ENV !== "production") {
        console.log(`[auth] password reset token for ${user.email}: ${token}`)
      }

      await audit({
        userId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        entity: "USER",
        entityId: user.id,
        details: { email: normalized },
      })
    }

    return NextResponse.json({
      message: "If that email is registered, a reset link is on its way.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }
    console.error("[auth] forgot-password failed:", error)
    return NextResponse.json({ error: "Unable to process request" }, { status: 500 })
  }
}
