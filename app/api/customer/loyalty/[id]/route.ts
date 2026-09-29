import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const customer = await prisma.loyaltyCustomer.findUnique({
      where: { id },
      include: {
        activities: {
          orderBy: {
            timestamp: "desc",
          },
          take: 10,
        },
      },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error("Error fetching loyalty customer:", error)
    return NextResponse.json({ error: "Failed to fetch customer data" }, { status: 500 })
  }
}
