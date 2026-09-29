import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth-middleware"
import { z } from "zod"

// Schema for seating a customer
const seatCustomerSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
})

// POST - Seat a customer from the wait list
export const POST = withAuth(async (req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const body = await req.json()

    // Validate request body
    const validatedData = seatCustomerSchema.parse(body)

    // Check if wait list entry exists
    const waitListEntry = await prisma.waitList.findUnique({
      where: { id },
    })

    if (!waitListEntry) {
      return NextResponse.json({ error: "Wait list entry not found" }, { status: 404 })
    }

    // Check if table exists
    const table = await prisma.table.findUnique({
      where: { id: validatedData.tableId },
    })

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 })
    }

    // Check if table is available
    if (table.status !== "available") {
      return NextResponse.json({ error: "Table is not available" }, { status: 400 })
    }

    // Update table status to occupied
    await prisma.table.update({
      where: { id: validatedData.tableId },
      data: {
        status: "occupied",
        customerName: waitListEntry.customerName,
        customerCount: waitListEntry.partySize,
        startTime: new Date(),
      },
    })

    // Remove from wait list
    await prisma.waitList.delete({
      where: { id },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user.sub,
        action: "SEAT",
        entity: "WAITLIST",
        entityId: id,
        details: {
          customerName: waitListEntry.customerName,
          tableId: validatedData.tableId,
          tableNumber: table.number,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error seating customer:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to seat customer" }, { status: 500 })
  }
})
