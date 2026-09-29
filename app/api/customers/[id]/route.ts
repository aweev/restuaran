import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/middleware/auth-middleware"
import { z } from "zod"

// GET - Fetch a specific customer
export const GET = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const { id } = params

    const customer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error("Error fetching customer:", error)
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 })
  }
})

// Schema for updating customers
const updateCustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required").optional(),
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

// PUT - Update a customer
export const PUT = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const { id } = params
    const body = await req.json()

    // Validate request body
    const validatedData = updateCustomerSchema.parse(body)

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Update customer
    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        name: validatedData.name,
        email: validatedData.email,
        phone: validatedData.phone,
        notes: validatedData.notes,
        allergies: validatedData.allergies,
        dietaryRestrictions: validatedData.dietaryRestrictions,
        favoriteItems: validatedData.favoriteItems,
        seatingPreferences: validatedData.seatingPreferences,
        visitCount: validatedData.visitCount,
        lastVisit: validatedData.lastVisit ? new Date(validatedData.lastVisit) : existingCustomer.lastVisit,
        totalSpent: validatedData.totalSpent,
      },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.headers.get("user-id") || "unknown",
        action: "UPDATE",
        entity: "CUSTOMER",
        entityId: id,
        details: {
          name: updatedCustomer.name,
        },
      },
    })

    return NextResponse.json(updatedCustomer)
  } catch (error) {
    console.error("Error updating customer:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 })
  }
})

// DELETE - Delete a customer
export const DELETE = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const { id } = params

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Delete customer
    await prisma.customer.delete({
      where: { id },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.headers.get("user-id") || "unknown",
        action: "DELETE",
        entity: "CUSTOMER",
        entityId: id,
        details: {
          name: existingCustomer.name,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting customer:", error)
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 })
  }
})
