import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { withAuth } from "@/middleware/auth-middleware"

export const GET = withAuth(async () => {
  try {
    const ingredients = await sql`
      SELECT * FROM ingredients
      ORDER BY name ASC
    `

    return NextResponse.json(ingredients)
  } catch (error) {
    console.error("Error fetching ingredients:", error)
    return NextResponse.json({ error: "Failed to fetch ingredients" }, { status: 500 })
  }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { name, category, unit, currentStock, reorderLevel, unitCost, isActive } = body

    const result = await sql`
      INSERT INTO ingredients (name, category, unit, current_stock, reorder_level, unit_cost, is_active)
      VALUES (${name}, ${category}, ${unit}, ${currentStock}, ${reorderLevel}, ${unitCost}, ${isActive})
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error creating ingredient:", error)
    return NextResponse.json({ error: "Failed to create ingredient" }, { status: 500 })
  }
})
