import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { z } from "zod"

// Schema for validating feedback data
const feedbackSchema = z.object({
  orderId: z.string().nullable(),
  tableNumber: z.string().nullable(),
  rating: z.number().min(1).max(5),
  foodQuality: z.number().min(1).max(5).nullable(),
  serviceQuality: z.number().min(1).max(5).nullable(),
  ambience: z.number().min(1).max(5).nullable(),
  comments: z.string().optional(),
  timestamp: z.string().datetime(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body
    const validatedData = feedbackSchema.parse(body)

    // Create feedback entry
    const feedback = await prisma.feedback.create({
      data: {
        orderId: validatedData.orderId,
        tableId: validatedData.tableNumber,
        rating: validatedData.rating,
        foodQuality: validatedData.foodQuality || undefined,
        serviceQuality: validatedData.serviceQuality || undefined,
        ambience: validatedData.ambience || undefined,
        comments: validatedData.comments || undefined,
        timestamp: new Date(validatedData.timestamp),
      },
    })

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "FEEDBACK",
        entityId: feedback.id,
        details: {
          orderId: validatedData.orderId,
          tableId: validatedData.tableNumber,
          rating: validatedData.rating,
        },
      },
    })

    return NextResponse.json({ success: true, id: feedback.id }, { status: 201 })
  } catch (error) {
    console.error("Error creating feedback:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 })
  }
}
