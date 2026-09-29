import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth-middleware"
import { z } from "zod"

// GET - Fetch a specific wait list entry
export const GET = withAuth(async (req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params

    const waitListEntry = await prisma.waitList.findUnique({
      where: { id },
    })

    if (!waitListEntry) {
      return NextResponse.json({ error: "Wait list entry not found" }, { status: 404 })
    }

    return NextResponse.json(waitListEntry)
  } catch (error) {
    console.error("Error fetching wait list entry:", error)
    return NextResponse.json({ error: "Failed to fetch wait list entry" }, { status: 500 })
  }
})

// Schema for updating wait list entries
const updateWaitListSchema = z.object({
  customerName: z.string().min(1, "Customer name is required").optional(),
  phoneNumber: z.string().optional(),
  partySize: z.number().int().positive().optional(),
  estimatedWaitTime: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  notified: z.boolean().optional(),
})

// PATCH - Update a wait list entry
export const PATCH = withAuth(async (req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const body = await req.json()

    // Validate request body
    const validatedData = updateWaitListSchema.parse(body)

    // Check if wait list entry exists
    const existingEntry = await prisma.waitList.findUnique({
      where: { id },
    })

    if (!existingEntry) {
      return NextResponse.json({ error: "Wait list entry not found" }, { status: 404 })
    }

    // Update wait list entry
    const updatedEntry = await prisma.waitList.update({
      where: { id },
      data: validatedData,
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user.sub,
        action: "UPDATE",
        entity: "WAITLIST",
        entityId: id,
        details: {
          customerName: updatedEntry.customerName,
          notified: updatedEntry.notified,
        },
      },
    })

    return NextResponse.json(updatedEntry)
  } catch (error) {
    console.error("Error updating wait list entry:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to update wait list entry" }, { status: 500 })
  }
})

// DELETE - Remove a wait list entry
export const DELETE = withAuth(async (req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params

    // Check if wait list entry exists
    const existingEntry = await prisma.waitList.findUnique({
      where: { id },
    })

    if (!existingEntry) {
      return NextResponse.json({ error: "Wait list entry not found" }, { status: 404 })
    }

    // Delete wait list entry
    await prisma.waitList.delete({
      where: { id },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user.sub,
        action: "DELETE",
        entity: "WAITLIST",
        entityId: id,
        details: {
          customerName: existingEntry.customerName,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting wait list entry:", error)
    return NextResponse.json({ error: "Failed to delete wait list entry" }, { status: 500 })
  }
})
