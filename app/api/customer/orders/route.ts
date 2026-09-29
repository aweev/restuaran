import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { z } from "zod"

// Schema for validating order data
const orderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      menuItemId: z.string(),
      title: z.string(),
      price: z.number(),
      quantity: z.number(),
      totalPrice: z.number(),
      type: z.enum(["Veg", "Non Veg"]),
      specialInstructions: z.string().optional(),
      modifiers: z
        .array(
          z.object({
            modifierId: z.string(),
            optionIds: z.array(z.string()),
          }),
        )
        .optional(),
    }),
  ),
  tableId: z.string().optional(),
  customerName: z.string(),
  diningMode: z.enum(["Dine in", "Take Away", "Delivery"]),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  notes: z.string().optional(),
  status: z.enum(["pending", "preparing", "ready", "delivered", "completed", "cancelled"]),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body
    const validatedData = orderSchema.parse(body)

    // Generate a unique order ID
    const orderId = crypto.randomUUID()

    // Insert order
    await prisma.order.create({
      data: {
        id: orderId,
        tableId: validatedData.tableId || null,
        customerName: validatedData.customerName,
        status: validatedData.status,
        diningMode: validatedData.diningMode,
        serverId: null, // No server assigned yet for customer orders
        subtotal: validatedData.subtotal,
        tax: validatedData.tax,
        discount: 0, // No discount applied initially
        total: validatedData.total,
        isPaid: false,
        notes: validatedData.notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: {
          create: validatedData.items.map((item) => ({
            menuItemId: item.menuItemId,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            specialInstructions: item.specialInstructions || null,
            type: item.type,
            modifierSelections: item.modifiers
              ? {
                  create: item.modifiers.map((modifier) => ({
                    modifierId: modifier.modifierId,
                    optionIds: modifier.optionIds,
                  })),
                }
              : undefined,
          })),
        },
      },
    })

    // If table ID is provided, update table status
    if (validatedData.tableId && validatedData.diningMode === "Dine in") {
      await prisma.table.update({
        where: { id: validatedData.tableId },
        data: {
          status: "occupied",
          customerName: validatedData.customerName,
          startTime: new Date(),
        },
      })
    }

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "ORDER",
        entityId: orderId,
        details: {
          source: "customer",
          tableId: validatedData.tableId,
          customerName: validatedData.customerName,
          total: validatedData.total,
          itemCount: validatedData.items.length,
        },
      },
    })

    // Return the created order ID
    return NextResponse.json({ id: orderId, status: "pending" }, { status: 201 })
  } catch (error) {
    console.error("Error creating customer order:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
