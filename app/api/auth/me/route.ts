import { type NextRequest, NextResponse } from "next/server"
import { getAccessTokenFromRequest, getCurrentUser, verifyAccessToken } from "@/lib/jwt"
import { one } from "@/lib/db-helpers"
import { z } from "zod"

export async function GET(req: NextRequest) {
  try {
    const token = getAccessTokenFromRequest(req)
    const user = await getCurrentUser(token)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Get current user error:", error)

    return NextResponse.json(
      { error: "An error occurred while fetching user data" },
      { status: 500 },
    )
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  avatar: z.string().max(512).nullable().optional(),
})

export async function PATCH(req: NextRequest) {
  const token = getAccessTokenFromRequest(req)
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const body = patchSchema.parse(await req.json())
    const sets: string[] = []
    const params: unknown[] = []
    let i = 1
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined) continue
      sets.push(`"${k}" = $${i++}`)
      params.push(v)
    }
    if (sets.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    params.push(String(payload.sub))
    const row = await one(
      `UPDATE "User" SET ${sets.join(", ")}, "updatedAt" = NOW() WHERE id = $${i} RETURNING id, name, email, role, avatar, phone, address, "hireDate", "isActive", "lastLogin", "customPermissions"`,
      params as (string | number | boolean | null)[],
    )
    return NextResponse.json(row)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[auth/me] patch failed:", error)
    return NextResponse.json({ error: "Unable to update profile" }, { status: 503 })
  }
}
