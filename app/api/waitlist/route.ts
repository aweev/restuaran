import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth-middleware"
import { z } from "zod"

// GET - Fetch all wait list entries
export const GET = withAuth(async () => {
  try {
    const waitList = await prisma.waitList.findMany({
      orderBy: {
        createdAt: "asc",
      },
    })

    return NextResponse.json(waitList)
  } catch (error) {
    console.error("Error fetching wait list:", error)
    return NextResponse.json({ error: "Failed to fetch wait list" }, { status: 500 })
  }
})

// Schema for creating wait list entries
const createWaitListSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  phoneNumber: z.string().optional(),
  partySize: z.number().int().positive(),
  estimatedWaitTime: z.number().int().min(0),
  notes: z.string().optional(),
})

// POST - Create a new wait list entry
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json()

    // Validate request body
    const validatedData = createWaitListSchema.parse(body)

    // Create wait list entry
    const waitListEntry = await prisma.waitList.create({
      data: {
        customerName: validatedData.customerName,
        phoneNumber: validatedData.phoneNumber || "",
        partySize: validatedData.partySize,
        estimatedWaitTime: validatedData.estimatedWaitTime,
        notes: validatedData.notes || "",
        notified: false,
      },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user.sub,
        action: "CREATE",
        entity: "WAITLIST",
        entityId: waitListEntry.id,
        details: {
          customerName: waitListEntry.customerName,
          partySize: waitListEntry.partySize,
        },
      },
    })

    return NextResponse.json(waitListEntry, { status: 201 })
  } catch (error) {
    console.error("Error creating wait list entry:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to create wait list entry" }, { status: 500 })
  }
})
