import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { z } from "zod"

// Schema for validating redemption data
const redeemSchema = z.object({
  customerId: z.string(),
  rewardId: z.string(),
  tableNumber: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body
    const validatedData = redeemSchema.parse(body)

    // Get customer and reward
    const [customer, reward] = await Promise.all([
      prisma.loyaltyCustomer.findUnique({
        where: { id: validatedData.customerId },
      }),
      prisma.loyaltyReward.findUnique({
        where: { id: validatedData.rewardId },
      }),
    ])

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 })
    }

    if (!reward.available) {
      return NextResponse.json({ error: "Reward is not available" }, { status: 400 })
    }

    if (customer.points < reward.pointsCost) {
      return NextResponse.json({ error: "Insufficient points" }, { status: 400 })
    }

    // Create redemption transaction
    const redemption = await prisma.loyaltyRedemption.create({
      data: {
        customerId: customer.id,
        rewardId: reward.id,
        pointsCost: reward.pointsCost,
        tableNumber: validatedData.tableNumber || null,
        timestamp: new Date(),
      },
    })

    // Update customer points
    const updatedCustomer = await prisma.loyaltyCustomer.update({
      where: { id: customer.id },
      data: {
        points: customer.points - reward.pointsCost,
        lastActivity: new Date(),
      },
    })

    // Create loyalty activity record
    await prisma.loyaltyActivity.create({
      data: {
        customerId: customer.id,
        type: "redemption",
        points: -reward.pointsCost,
        description: `Redeemed: ${reward.name}`,
        timestamp: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      redemption,
      newPointsBalance: updatedCustomer.points,
    })
  } catch (error) {
    console.error("Error redeeming reward:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to redeem reward" }, { status: 500 })
  }
}
