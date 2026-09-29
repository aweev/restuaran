import { type NextRequest as BaseNextRequest, NextResponse } from "next/server"

interface NextRequest extends BaseNextRequest {
  user?: {
    sub: string
    email: string
    role: string
  }
}
import prisma from "@/lib/prisma"
import { withAuth } from "@/middleware/auth-middleware"
import { z } from "zod"

// GET - Fetch all customers
export const GET = withAuth(async () => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error("Error fetching customers:", error)
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 })
  }
})

// Schema for creating customers
const createCustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  dietaryRestrictions: z.string().optional().nullable(),
  favoriteItems: z.string().optional().nullable(),
  seatingPreferences: z.string().optional().nullable(),
  visitCount: z.number().int().min(0).optional(),
  lastVisit: z.string().datetime().optional().nullable(),
  totalSpent: z.number().min(0).optional(),
})

// POST - Create a new customer
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()

    // Validate request body
    const validatedData = createCustomerSchema.parse(body)

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        name: validatedData.name,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        notes: validatedData.notes || null,
        allergies: validatedData.allergies || null,
        dietaryRestrictions: validatedData.dietaryRestrictions || null,
        favoriteItems: validatedData.favoriteItems || null,
        seatingPreferences: validatedData.seatingPreferences || null,
        visitCount: validatedData.visitCount || 0,
        lastVisit: validatedData.lastVisit ? new Date(validatedData.lastVisit) : null,
        totalSpent: validatedData.totalSpent || 0,
        userId: req.user?.sub || "unknown",
      },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user?.sub || "unknown",
        action: "CREATE",
        entity: "CUSTOMER",
        entityId: customer.id,
        details: {
          name: customer.name,
          email: customer.email,
        },
      },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error("Error creating customer:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 })
  }
})
