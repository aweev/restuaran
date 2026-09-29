import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/middleware/auth-middleware"
import { z } from "zod"

// GET - Fetch all preparation times
export const GET = withAuth(async () => {
  try {
    const prepTimes = await prisma.preparationTime.findMany()

    // Transform to a key-value object
    interface PreparationTime {
      menuItemId: string
      timeInMinutes: number
    }

    const prepTimesMap = prepTimes.reduce(
      (acc: Record<string, number>, item: PreparationTime) => {
      acc[item.menuItemId] = item.timeInMinutes
      return acc
      },
      {} as Record<string, number>,
    )

    return NextResponse.json(prepTimesMap)
  } catch (error) {
    console.error("Error fetching preparation times:", error)
    return NextResponse.json({ error: "Failed to fetch preparation times" }, { status: 500 })
  }
})

// Schema for preparation time
const prepTimeSchema = z.object({
  menuItemId: z.string(),
  time: z.number().min(1).max(120),
})

// POST - Create or update a preparation time
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()

    // Validate request body
    const validatedData = prepTimeSchema.parse(body)

    // Check if prep time already exists
    const existingPrepTime = await prisma.preparationTime.findUnique({
      where: { menuItemId: validatedData.menuItemId },
    })

    if (existingPrepTime) {
      // Update existing prep time
      const updatedPrepTime = await prisma.preparationTime.update({
        where: { menuItemId: validatedData.menuItemId },
        data: {
          timeInMinutes: validatedData.time,
        },
      })

      return NextResponse.json(updatedPrepTime)
    } else {
      // Create new prep time
      const newPrepTime = await prisma.preparationTime.create({
        data: {
          menuItemId: validatedData.menuItemId,
          timeInMinutes: validatedData.time,
        },
      })

      return NextResponse.json(newPrepTime)
    }
  } catch (error) {
    console.error("Error creating/updating preparation time:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to create/update preparation time" }, { status: 500 })
  }
})
