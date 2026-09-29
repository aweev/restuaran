import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { z } from "zod"

// Schema for validating delivery request data
const deliverySchema = z.object({
  provider: z.enum(["doordash", "ubereats", "grubhub", "restaurant"]),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    instructions: z.string().optional(),
  }),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // Validate request body
    const validatedData = deliverySchema.parse(body)

    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Update order with delivery information
    await prisma.order.update({
      where: { id },
      data: {
        diningMode: "Delivery",
        deliveryInfo: {
          create: {
            provider: validatedData.provider,
            status: "pending",
            address: {
              street: validatedData.address.street,
              city: validatedData.address.city,
              state: validatedData.address.state,
              zipCode: validatedData.address.zipCode,
              instructions: validatedData.address.instructions,
            },
            estimatedDeliveryTime: new Date(Date.now() + 45 * 60 * 1000), // 45 minutes from now
          },
        },
      },
    })

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "ORDER",
        entityId: id,
        details: {
          update: "delivery_setup",
          provider: validatedData.provider,
        },
      },
    })

    // For third-party delivery services, simulate API integration
    let redirectUrl = null
    if (validatedData.provider !== "restaurant") {
      // In a real implementation, this would call the delivery service's API
      // For now, we'll just simulate a redirect URL
      redirectUrl = `https://${validatedData.provider}.com/tracking?orderId=${id}`
    }

    return NextResponse.json({
      success: true,
      provider: validatedData.provider,
      redirectUrl,
    })
  } catch (error) {
    console.error("Error setting up delivery:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to set up delivery" }, { status: 500 })
  }
}
