import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const rewards = await prisma.loyaltyReward.findMany({
      where: {
        available: true,
      },
      orderBy: {
        pointsCost: "asc",
      },
    })

    return NextResponse.json(rewards)
  } catch (error) {
    console.error("Error fetching loyalty rewards:", error)
    return NextResponse.json({ error: "Failed to fetch rewards" }, { status: 500 })
  }
}
