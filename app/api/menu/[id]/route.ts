import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/middleware/auth-middleware"
import { z } from "zod"

// GET a specific menu item
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const menuItem = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        modifiers: {
          include: {
            options: true,
          },
        },
      },
    })

    if (!menuItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 })
    }

    return NextResponse.json(menuItem)
  } catch (error) {
    console.error("Error fetching menu item:", error)
    return NextResponse.json({ error: "Failed to fetch menu item" }, { status: 500 })
  }
}

// Schema for updating menu items
const updateMenuItemSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").optional(),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive").optional(),
  image: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(["Veg", "NonVeg"]).optional(),
  available: z.boolean().optional(),
  discount: z.number().optional().nullable(),
  popular: z.boolean().optional(),
  allergens: z.array(z.string()).optional(),
  calories: z.number().optional().nullable(),
  protein: z.number().optional().nullable(),
  carbs: z.number().optional().nullable(),
  fat: z.number().optional().nullable(),
})

// PUT - Update a menu item
export const PUT = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const { id } = await params
    const body = await req.json()

    // Validate request body
    const validatedData = updateMenuItemSchema.parse(body)

    // Check if menu item exists
    const existingItem = await prisma.menuItem.findUnique({
      where: { id },
    })

    if (!existingItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 })
    }

    // Update menu item
    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data: validatedData,
      include: {
        modifiers: {
          include: {
            options: true,
          },
        },
      },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.headers.get("user-id") || "unknown",
        action: "UPDATE",
        entity: "MENU_ITEM",
        entityId: id,
        details: { title: updatedItem.title },
      },
    })

    return NextResponse.json(updatedItem)
  } catch (error) {
    console.error("Error updating menu item:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to update menu item" }, { status: 500 })
  }
})

// DELETE - Delete a menu item
export const DELETE = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const { id } = await params

    // Check if menu item exists
    const existingItem = await prisma.menuItem.findUnique({
      where: { id },
    })

    if (!existingItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 })
    }

    // Delete menu item (this will cascade delete modifiers and options)
    await prisma.menuItem.delete({
      where: { id },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.headers.get("user-id") || "unknown",
        action: "DELETE",
        entity: "MENU_ITEM",
        entityId: id,
        details: { title: existingItem.title },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting menu item:", error)
    return NextResponse.json({ error: "Failed to delete menu item" }, { status: 500 })
  }
})
