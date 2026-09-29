import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/middleware/auth-middleware"

// DELETE - Remove a staff assignment
export const DELETE = withAuth(async (req: NextRequest) => {
  const { params: { userId } } = req as unknown as { params: { userId: string } };
  try {

    // Check if assignment exists
    const existingAssignment = await prisma.kitchenStaffAssignment.findUnique({
      where: { userId },
    })

    if (!existingAssignment) {
      return NextResponse.json({ error: "Staff assignment not found" }, { status: 404 })
    }

    // Delete the assignment
    await prisma.kitchenStaffAssignment.delete({
      where: { userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting staff assignment:", error)
    return NextResponse.json({ error: "Failed to delete staff assignment" }, { status: 500 })
  }
})
