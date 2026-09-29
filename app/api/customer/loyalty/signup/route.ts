import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { z } from "zod"

// Schema for validating signup data
const signupSchema = z.object({
  email: z.string().email(),
  phone: z.string(),
  tableNumber: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body
    const validatedData = signupSchema.parse(body)

    // Check if customer already exists
    const existingCustomer = await prisma.loyaltyCustomer.findFirst({
      where: {
        OR: [{ email: validatedData.email }, { phone: validatedData.phone }],
      },
    })

    if (existingCustomer) {
      return NextResponse.json({ error: "Customer already exists" }, { status: 400 })
    }

    // Create new customer
    const customer = await prisma.loyaltyCustomer.create({
      data: {
        email: validatedData.email,
        phone: validatedData.phone,
        name: validatedData.email.split("@")[0], // Default name from email
        points: 100, // Welcome points
        tier: "bronze",
        joinDate: new Date(),
        lastActivity: new Date(),
        totalSpent: 0,
        visitsCount: 1,
      },
    })

    // Create loyalty activity record for welcome points
    await prisma.loyaltyActivity.create({
      data: {
        customerId: customer.id,
        type: "welcome",
        points: 100,
        description: "Welcome bonus",
        timestamp: new Date(),
      },
    })

    return NextResponse.json({ customer })
  } catch (error) {
    console.error("Error signing up for loyalty program:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to sign up" }, { status: 500 })
  }
}
