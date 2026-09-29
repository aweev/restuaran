import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/middleware/auth-middleware"
import { z } from "zod"

// GET all payments for an order
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const payments = await prisma.payment.findMany({
      where: { orderId: id },
      orderBy: { timestamp: "desc" },
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error("Error fetching payments:", error)
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 })
  }
}

// Schema for creating payments
const paymentSchema = z.object({
  method: z.enum(["cash", "credit", "debit", "mobile", "gift"]),
  amount: z.number().positive(),
  reference: z.string().optional(),
})

// POST - Add a payment to an order
export const POST = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const { id } = await params
    const body = await req.json()

    // Validate request body
    const validatedData = paymentSchema.parse(body)

    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        ...validatedData,
        orderId: id,
        timestamp: new Date(),
      },
    })

    // Calculate total paid amount
    const totalPaid = [...order.payments, payment].reduce((sum, p) => sum + p.amount, 0)

    // Update order's isPaid status if total paid amount covers the total
    if (totalPaid >= order.total && !order.isPaid) {
      await prisma.order.update({
        where: { id },
        data: { isPaid: true },
      })
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.headers.get("user-id") || "unknown",
        action: "PAYMENT",
        entity: "ORDER",
        entityId: id,
        details: {
          method: payment.method,
          amount: payment.amount,
          isPaid: totalPaid >= order.total,
        },
      },
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error("Error adding payment:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to add payment" }, { status: 500 })
  }
})
