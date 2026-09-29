import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/middleware/auth-middleware"

// GET - Search customers
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get("q") || ""

    if (!query) {
      // If no query, return all customers
      const customers = await prisma.customer.findMany({
        orderBy: {
          name: "asc",
        },
        take: 20, // Limit to 20 results
      })

      return NextResponse.json(customers)
    }

    // Search customers by name, email, or phone
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error("Error searching customers:", error)
    return NextResponse.json({ error: "Failed to search customers" }, { status: 500 })
  }
})
