import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/middleware/auth-middleware"
import { z } from "zod"

// Schema for staff assignment
const staffAssignmentSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  station: z.string(),
  assignedOrders: z.array(z.string()).optional(),
})

// GET - Fetch all staff assignments
export const GET = withAuth(async () => {
  try {
    const staffAssignments = await prisma.kitchenStaffAssignment.findMany({
      include: {
        assignedOrders: true,
      },
    })

    // Transform the data to match the expected format
    interface StaffAssignment {
      userId: string;
      userName: string;
      station: string;
      assignedOrders: string[];
    }

    interface AssignedOrder {
      orderId: string;
    }

    interface RawStaffAssignment {
      userId: string;
      userName: string;
      station: string;
      assignedOrders: AssignedOrder[];
    }

    const formattedAssignments: StaffAssignment[] = staffAssignments.map((assignment: RawStaffAssignment) => ({
      userId: assignment.userId,
      userName: assignment.userName,
      station: assignment.station,
      assignedOrders: assignment.assignedOrders.map((order: AssignedOrder) => order.orderId),
    }));

    return NextResponse.json(formattedAssignments)
  } catch (error) {
    console.error("Error fetching staff assignments:", error)
    return NextResponse.json({ error: "Failed to fetch staff assignments" }, { status: 500 })
  }
})

// POST - Create or update a staff assignment
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()

    // Validate request body
    const validatedData = staffAssignmentSchema.parse(body)

    // Check if assignment already exists
    const existingAssignment = await prisma.kitchenStaffAssignment.findUnique({
      where: { userId: validatedData.userId },
    })

    if (existingAssignment) {
      // Update existing assignment
      const updatedAssignment = await prisma.kitchenStaffAssignment.update({
        where: { userId: validatedData.userId },
        data: {
          userName: validatedData.userName,
          station: validatedData.station,
        },
      })

      return NextResponse.json(updatedAssignment)
    } else {
      // Create new assignment
      const newAssignment = await prisma.kitchenStaffAssignment.create({
        data: {
          userId: validatedData.userId,
          userName: validatedData.userName,
          station: validatedData.station,
        },
      })

      return NextResponse.json(newAssignment)
    }
  } catch (error) {
    console.error("Error creating/updating staff assignment:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to create/update staff assignment" }, { status: 500 })
  }
})
