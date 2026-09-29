import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    // Get popular menu items
    const popularItems = await prisma.menuItem.findMany({
      where: {
        available: true,
        popular: true,
      },
      take: 5,
    })

    return NextResponse.json(popularItems)
  } catch (error) {
    console.error("Error fetching popular items:", error)
    return NextResponse.json({ error: "Failed to fetch popular items" }, { status: 500 })
  }
}
