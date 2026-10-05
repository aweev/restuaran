import { type NextRequest, NextResponse } from "next/server"
import { many, sqlWrite, audit } from "@/lib/db-helpers"
import { signTokenPair, setAuthCookies, clearAuthCookies, getRefreshTokenFromRequest, verifyRefreshToken } from "@/lib/jwt"

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

export async function POST(req: NextRequest) {
  const refreshToken = getRefreshTokenFromRequest(req)

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 })
  }

  const payload = await verifyRefreshToken(refreshToken)
  if (!payload || typeof payload.sub !== "string") {
    const response = NextResponse.json({ error: "Invalid refresh token" }, { status: 401 })
    clearAuthCookies(response)
    return response
  }

  const userId = payload.sub

  const users = (await many(
    `SELECT * FROM "User" WHERE id = $1`,
    [userId],
  )) as unknown as LoginUserRow[]

  const user = users[0]

  if (!user || !user.isActive) {
    const response = NextResponse.json({ error: "User not found or inactive" }, { status: 401 })
    clearAuthCookies(response)
    return response
  }

  const newTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  }

  const { accessToken, refreshToken: newRefreshToken } = await signTokenPair(newTokenPayload)

  try {
    await sqlWrite(
      `UPDATE "User" SET "lastLogin" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
      [user.id],
    )
  } catch (err) {
    console.error("[auth:refresh] could not record lastLogin:", err)
  }

  await audit({
    userId: user.id,
    action: "TOKEN_REFRESH",
    entity: "USER",
    entityId: user.id,
    details: {},
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

  setAuthCookies(response, accessToken, newRefreshToken)

  return response
}
