import { type NextRequest, NextResponse } from "next/server"
import { hashPassword, generateToken, registerSchema } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { ZodError } from "zod"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body
    const { name, email, password, role, phone, address } = registerSchema.parse(body)

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create new user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        phone,
        address,
        isActive: true,
        hireDate: new Date(),
      },
    })

    // Generate JWT token
    const token = generateToken(user.id, user.email, user.role)

    // Log the registration action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "REGISTER",
        entity: "USER",
        entityId: user.id,
        details: { email: user.email, role: user.role },
      },
    })

    // Return user data and token
    return NextResponse.json({
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
        customPermissions: user.customPermissions,
      },
      token,
    })
  } catch (error) {
    console.error("Registration error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "An error occurred during registration" }, { status: 500 })
  }
}
