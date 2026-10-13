import { type NextRequest, NextResponse } from "next/server"
import { signTokenPair, setAuthCookies } from "@/lib/jwt"
import { hash } from "bcrypt"
import { one, sqlWrite, audit } from "@/lib/db-helpers"
import { z, ZodError } from "zod"

const registerSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  // Full UserRole union (types/auth): the signup form defaults to "server",
  // which the old short enum rejected with a bare 400.
  role: z.enum([
    "admin", "manager", "owner", "server", "waiter", "host", "host_staff",
    "cashier", "bartender", "delivery", "kitchen", "staff",
  ]),
  phone: z.string().optional(),
  address: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, role, phone, address } = registerSchema.parse(body)
    const normalizedEmail = email.toLowerCase().trim()

    const existing = await one(`SELECT id FROM "User" WHERE LOWER(email) = $1`, [normalizedEmail])
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 })
    }

    const hashedPassword = await hash(password, 10)
    const id = crypto.randomUUID()

    const rows = await sqlWrite(
      `INSERT INTO "User" (id, name, email, password, role, phone, address, "isActive", "hireDate")
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW())
       RETURNING id, name, email, role, avatar, phone, address, "hireDate", "isActive", "lastLogin", "customPermissions"`,
      [id, name, normalizedEmail, hashedPassword, role, phone ?? null, address ?? null],
    )

    const user = rows[0]
    if (!user) throw new Error("User insert returned no row")

    // Sign with the same token-pair helper the login route uses, so tokens
    // minted at registration verify against the same secret/claims.
    const { accessToken, refreshToken } = await signTokenPair({
      sub: user.id as string,
      email: user.email as string,
      role: user.role as string,
      name: user.name as string,
    })

    await audit({
      userId: user.id as string,
      action: "REGISTER",
      entity: "USER",
      entityId: user.id as string,
      details: { email: user.email, role: user.role },
    })

    const response = NextResponse.json({ user, accessToken }, { status: 201 })
    setAuthCookies(response, accessToken, refreshToken)
    return response
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      )
    }
    console.error("[auth] registration failed:", error)
    return NextResponse.json(
      { error: "An error occurred during registration" },
      { status: 500 },
    )
  }
}

