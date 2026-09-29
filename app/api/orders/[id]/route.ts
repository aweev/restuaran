import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/middleware/auth-middleware"
import { z } from "zod"
import { Prisma } from "@prisma/client"

// Extend NextRequest to include user property
interface AuthenticatedRequest extends NextRequest {
  user: {
    sub: string
    email: string
    role: string
  }
}

// GET a specific order
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        table: true,
        items: {
          include: {
            modifierSelections: true,
          },
        },
        payments: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error("Error fetching order:", error)
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 })
  }
}

// Schema for updating orders
const updateOrderSchema = z.object({
  status: z.enum(["pending", "preparing", "ready", "delivered", "completed", "cancelled"]).optional(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        id: z.string(),
        menuItemId: z.string(),
        title: z.string(),
        price: z.number(),
        quantity: z.number(),
        totalPrice: z.number(),
        type: z.enum(["Veg", "Non Veg"]),
        specialInstructions: z.string().optional().nullable(),
        modifiers: z
          .array(
            z.object({
              modifierId: z.string(),
              optionIds: z.array(z.string()),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
})

// PUT - Update an order
export const PUT = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const { id } = await params
    const body = await req.json()

    // Validate request body
    const validatedData = updateOrderSchema.parse(body)

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        table: true,
        items: {
          include: {
            modifierSelections: true,
          },
        },
      },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // If status is changing to completed or cancelled, update table status
    if (
      validatedData.status &&
      (validatedData.status === "completed" || validatedData.status === "cancelled") &&
      existingOrder.tableId
    ) {
      await prisma.table.update({
        where: { id: existingOrder.tableId },
        data: {
          status: "dirty",
          customerName: null,
          customerCount: null,
          startTime: null,
        },
      })
    }

    interface TransactionResult {
      id: string
      table: {
        id: string
        status: string
        customerName: string | null
        customerCount: number | null
        startTime: Date | null
      }
      items: Array<{
      id: string
      menuItemId: string
      title: string
      price: number
      quantity: number
      totalPrice: number
      type: "Veg" | "Non Veg"
      specialInstructions?: string | null
      modifierSelections: Array<{
        id: string
        modifierId: string
        optionIds: string[]
      }>
      }>
      payments: Array<{
        id: string
        amount: number
        method: string
        status: string
        createdAt: Date
      }>
      userId: string
    }

    const result: TransactionResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update order items if provided
      if (validatedData.items) {
      // Delete existing items and their modifier selections
      await tx.orderItem.deleteMany({
        where: { orderId: id },
      })

      // Create new items
      for (const item of validatedData.items) {
        const newItem = await tx.orderItem.create({
        data: {
          orderId: id,
          menuItemId: item.menuItemId,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          type: item.type,
          specialInstructions: item.specialInstructions,
        },
        })

        // Create modifier selections if any
        if (item.modifiers && item.modifiers.length > 0) {
        for (const modifier of item.modifiers) {
          await tx.modifierSelection.create({
          data: {
            orderItemId: newItem.id,
            modifierId: modifier.modifierId,
            optionIds: modifier.optionIds,
          },
          })
        }
        }
      }

      // Recalculate totals
      const subtotal = validatedData.items.reduce((sum, item) => sum + item.totalPrice, 0)
      const taxRate = 0.05 // 5% tax rate
      const tax = subtotal * taxRate
      const total = subtotal + tax - existingOrder.discount

      // Update order with new totals
      await tx.order.update({
        where: { id },
        data: {
        subtotal,
        tax,
        total,
        notes: validatedData.notes,
        status: validatedData.status,
        updatedAt: new Date(),
        },
      })
      } else {
      // Just update status and notes
      await tx.order.update({
        where: { id },
        data: {
        status: validatedData.status,
        notes: validatedData.notes,
        updatedAt: new Date(),
        },
      })
      }

      // Return the updated order
      return tx.order.findUnique({
      where: { id },
      include: {
        table: true,
        items: {
        include: {
          modifierSelections: true,
        },
        },
        payments: true,
      },
      }) as TransactionResult
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: (req as AuthenticatedRequest).user.sub,
        action: "UPDATE",
        entity: "ORDER",
        entityId: id,
        details: {
          status: validatedData.status,
          notes: validatedData.notes,
          itemsUpdated: validatedData.items ? true : false,
        },
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error updating order:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
})

// PATCH - Update order status
export const PATCH = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const { id } = await params
    const body = await req.json()

    // Validate status
    if (
      !body.status ||
      !["pending", "preparing", "ready", "delivered", "completed", "cancelled"].includes(body.status)
    ) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: { table: true },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // If status is changing to completed or cancelled, update table status
    if ((body.status === "completed" || body.status === "cancelled") && existingOrder.tableId) {
      await prisma.table.update({
        where: { id: existingOrder.tableId },
        data: {
          status: "dirty",
          customerName: null,
          customerCount: null,
          startTime: null,
        },
      })
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: body.status,
        notes: body.notes || existingOrder.notes,
        updatedAt: new Date(),
      },
      include: {
        table: true,
        items: {
          include: {
            modifierSelections: true,
          },
        },
        payments: true,
      },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: (req as AuthenticatedRequest).user.sub,
        action: "STATUS_UPDATE",
        entity: "ORDER",
        entityId: id,
        details: {
          oldStatus: existingOrder.status,
          newStatus: body.status,
        },
      },
    })

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error("Error updating order status:", error)
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 })
  }
})

// DELETE - Delete an order
export const DELETE = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const { id } = await params

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: { table: true },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // If order has a table, update table status
    if (existingOrder.tableId) {
      await prisma.table.update({
        where: { id: existingOrder.tableId },
        data: {
          status: "available",
          customerName: null,
          customerCount: null,
          startTime: null,
        },
      })
    }

    // Delete order (this will cascade delete items, modifier selections, and payments)
    await prisma.order.delete({
      where: { id },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: (req as AuthenticatedRequest).user.sub,
        action: "DELETE",
        entity: "ORDER",
        entityId: id,
        details: {
          tableId: existingOrder.tableId,
          customerName: existingOrder.customerName,
          total: existingOrder.total,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting order:", error)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
})
