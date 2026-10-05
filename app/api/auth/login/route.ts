import { type NextRequest, NextResponse } from "next/server"
import { many, sqlWrite, audit } from "@/lib/db-helpers"
import { signTokenPair, setAuthCookies } from "@/lib/jwt"
import { compare } from "bcrypt"
import { z } from "zod"
import { rateLimit, clearRateLimit, getClientIp } from "@/lib/rate-limiter"

/** Row shape returned by `SELECT * FROM "User"`. */
interface LoginUserRow {
  id: string
  name: string
  email: string
  role: string
  password: string
  avatar: string | null
  phone: string | null
  address: string | null
  hireDate: Date | string | null
  isActive: boolean
  lastLogin: Date | string | null
  customPermissions: string[] | null
}

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

/** Uniform failure so the endpoint cannot be used to enumerate accounts. */
function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  try {
    const body = await req.json()
    const { email, password } = loginSchema.parse(body)
    const normalizedEmail = email.toLowerCase().trim()
    const limitKey = `${ip}:${normalizedEmail}`

    const { blocked, retryInMinutes } = await rateLimit(limitKey, {
      maxAttempts: 8,
      windowMs: 15 * 60 * 1000,
      keyPrefix: "auth:login:",
    })
    if (blocked) {
      return NextResponse.json(
        {
          error: "Too many sign-in attempts. Please wait before trying again.",
          retryInMinutes,
        },
        { status: 429 },
      )
    }

    const users = (await many(
      `SELECT * FROM "User" WHERE LOWER(email) = $1`,
      [normalizedEmail],
    )) as unknown as LoginUserRow[]

    const user = users[0]

    if (!user) {
      return unauthorized()
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "This account has been deactivated. Contact a manager." },
        { status: 403 },
      )
    }

    const isPasswordValid = await compare(password, user.password)
    if (!isPasswordValid) {
      await audit({
        userId: user.id,
        action: "LOGIN_FAILED",
        entity: "USER",
        entityId: user.id,
        details: { email: normalizedEmail, ip },
      })
      return unauthorized()
    }

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    }

    const { accessToken, refreshToken } = await signTokenPair(tokenPayload)

    try {
      await sqlWrite(
        `UPDATE "User" SET "lastLogin" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
        [user.id],
      )
    } catch (err) {
      console.error("[auth] could not record lastLogin:", err)
    }

    await clearRateLimit(limitKey, "auth:login:")

    await audit({
      userId: user.id,
      action: "LOGIN",
      entity: "USER",
      entityId: user.id,
      details: { email: user.email, role: user.role, ip },
    })

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
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      )
    }
    console.error("[auth] login failed:", error)
    return NextResponse.json(
      { error: "Unable to sign in right now. Please try again." },
      { status: 503 },
    )
  }
}

