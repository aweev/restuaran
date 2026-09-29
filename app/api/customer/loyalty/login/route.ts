import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { z } from "zod"

// Schema for validating login data
const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body
    const validatedData = loginSchema.parse(body)

    if (!validatedData.email && !validatedData.phone) {
      return NextResponse.json({ error: "Email or phone is required" }, { status: 400 })
    }

    // Find customer by email or phone
    const customer = await prisma.loyaltyCustomer.findFirst({
      where: {
        OR: [
          validatedData.email ? { email: validatedData.email } : {},
          validatedData.phone ? { phone: validatedData.phone } : {},
        ],
      },
    })

    if (!customer) {
      return NextResponse.json({ customer: null })
    }

    // Update last activity timestamp
    await prisma.loyaltyCustomer.update({
      where: { id: customer.id },
      data: {
        lastActivity: new Date(),
      },
    })

    return NextResponse.json({ customer })
  } catch (error) {
    console.error("Error logging in to loyalty program:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to login" }, { status: 500 })
  }
}
