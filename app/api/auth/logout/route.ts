import { type NextRequest, NextResponse } from "next/server"
import { clearAuthCookies } from "@/lib/jwt"
import { audit } from "@/lib/db-helpers"
import { getTokenFromRequest, verifyAccessToken } from "@/lib/jwt"

export async function POST(req: NextRequest) {
  const accessToken = getTokenFromRequest(req)
  let userId: string | null = null

  if (accessToken) {
    const payload = await verifyAccessToken(accessToken)
    if (payload && typeof payload.sub === "string") {
      userId = payload.sub
    }
  }

  if (userId) {
    await audit({
      userId,
      action: "LOGOUT",
      entity: "USER",
      entityId: userId,
      details: {},
    })
  }

  const response = NextResponse.json({ success: true })
  clearAuthCookies(response)

  return response
}
