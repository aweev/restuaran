import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/middleware/auth-middleware"
import { z } from "zod"

// GET a specific table
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const table = await prisma.table.findUnique({
      where: { id },
    })

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 })
    }

    return NextResponse.json(table)
  } catch (error) {
    console.error("Error fetching table:", error)
    return NextResponse.json({ error: "Failed to fetch table" }, { status: 500 })
  }
}

// Schema for updating tables
const updateTableSchema = z.object({
  number: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  status: z.enum(["available", "occupied", "reserved", "dirty"]).optional(),
  customerName: z.string().optional().nullable(),
  customerCount: z.number().int().positive().optional().nullable(),
  startTime: z.string().datetime().optional().nullable(),
  serverName: z.string().optional().nullable(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
})

// PUT - Update a table
export const PUT = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const { id } = await params
    const body = await req.json()

    // Validate request body
    const validatedData = updateTableSchema.parse(body)

    // Check if table exists
    const existingTable = await prisma.table.findUnique({
      where: { id },
    })

    if (!existingTable) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 })
    }

    // If number is being updated, check if it already exists
    if (validatedData.number && validatedData.number !== existingTable.number) {
      const tableWithNumber = await prisma.table.findUnique({
        where: { number: validatedData.number },
      })

      if (tableWithNumber) {
        return NextResponse.json({ error: "Table number already exists" }, { status: 400 })
      }
    }

    // Update table
    const updatedTable = await prisma.table.update({
      where: { id },
      data: validatedData,
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user?.sub ?? "unknown",
        action: "UPDATE",
        entity: "TABLE",
        entityId: id,
        details: { number: updatedTable.number, status: updatedTable.status },
      },
    })

    return NextResponse.json(updatedTable)
  } catch (error) {
    console.error("Error updating table:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to update table" }, { status: 500 })
  }
})

// DELETE - Delete a table
export const DELETE = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const { id } = await params

    // Check if table exists
    const existingTable = await prisma.table.findUnique({
      where: { id },
    })

    if (!existingTable) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 })
    }

    // Delete table
    await prisma.table.delete({
      where: { id },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user?.sub ?? "unknown",
        action: "DELETE",
        entity: "TABLE",
        entityId: id,
        details: { number: existingTable.number },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting table:", error)
    return NextResponse.json({ error: "Failed to delete table" }, { status: 500 })
  }
})
