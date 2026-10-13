import { type NextRequest, NextResponse } from "next/server"
import { many, sqlWrite, audit } from "@/lib/db-helpers"
import { signTokenPair, setAuthCookies } from "@/lib/jwt"
import { compare } from "bcrypt"
import { z } from "zod"
import { rateLimit, clearRateLimit, getClientIp } from "@/lib/rate-limiter"

interface PinUserRow {
  id: string
  name: string
  email: string
  role: string
  avatar: string | null
  phone: string | null
  address: string | null
  hireDate: Date | string | null
  isActive: boolean
  lastLogin: Date | string | null
  customPermissions: string[] | null
  pinHash: string | null
  pinAttempts: number | null
  pinLockedUntil: Date | string | null
}

const schema = z.object({
  email: z.string().email("Invalid email address"),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4–6 digits"),
})

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

/** Uniform failure so the endpoint cannot be used to enumerate accounts. */
function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Invalid email or PIN" }, { status: 401 })
}

/**
 * Fast shared-device login: email + 4–6 digit PIN (bcrypt-hashed, never
 * logged). Same session cookies as password login. 5 bad tries lock the PIN
 * for 15 minutes; password login still works while locked.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  try {
    const { email, pin } = schema.parse(await req.json())
    const normalizedEmail = email.toLowerCase().trim()
    const limitKey = `${ip}:${normalizedEmail}`

    const { blocked, retryInMinutes } = await rateLimit(limitKey, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
      keyPrefix: "auth:pin:",
    })
    if (blocked) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Please wait before trying again.", retryInMinutes },
        { status: 429 },
      )
    }

    const users = (await many(
      `SELECT * FROM "User" WHERE LOWER(email) = $1`,
      [normalizedEmail],
    )) as unknown as PinUserRow[]
    const user = users[0]
    if (!user || !user.isActive || !user.pinHash) {
      if (user) {
        await audit({ userId: user.id, action: "PIN_LOGIN_FAILED", entity: "USER", entityId: user.id, details: { email: normalizedEmail, ip, reason: !user.isActive ? "inactive" : "no-pin" } })
      }
      return unauthorized()
    }

    if (user.pinLockedUntil && new Date(user.pinLockedUntil).getTime() > Date.now()) {
      return NextResponse.json(
        { error: `PIN locked after too many tries. Wait ${LOCK_MINUTES} minutes or use your password.` },
        { status: 423 },
      )
    }

    const ok = await compare(pin, user.pinHash)
    if (!ok) {
      const attempts = (user.pinAttempts ?? 0) + 1
      const locked = attempts >= MAX_ATTEMPTS
      await sqlWrite(
        `UPDATE "User" SET "pinAttempts" = $2, "pinLockedUntil" = ${locked ? `NOW() + INTERVAL '${LOCK_MINUTES} minutes'` : "NULL"}, "updatedAt" = NOW() WHERE id = $1`,
        [user.id, attempts],
      )
      await audit({ userId: user.id, action: "PIN_LOGIN_FAILED", entity: "USER", entityId: user.id, details: { email: normalizedEmail, ip, attempts } })
      return NextResponse.json(
        locked
          ? { error: `Too many wrong PINs. Locked for ${LOCK_MINUTES} minutes — use your password.` }
          : { error: `Wrong PIN. ${MAX_ATTEMPTS - attempts} tries left.` },
        { status: 401 },
      )
    }

    await sqlWrite(
      `UPDATE "User" SET "pinAttempts" = 0, "pinLockedUntil" = NULL, "lastLogin" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
      [user.id],
    )
    await clearRateLimit(limitKey, "auth:pin:")

    const { accessToken, refreshToken } = await signTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    })
    await audit({ userId: user.id, action: "PIN_LOGIN", entity: "USER", entityId: user.id, details: { email: user.email, role: user.role, ip } })

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        address: user.address,
        hireDate: user.hireDate,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        customPermissions: user.customPermissions || [],
      },
      accessToken,
    })
    setAuthCookies(response, accessToken, refreshToken)
    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[auth] pin login failed:", error)
    return NextResponse.json({ error: "Unable to sign in right now. Please try again." }, { status: 503 })
  }
}
