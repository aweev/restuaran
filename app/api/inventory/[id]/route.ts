import { NextResponse, NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { withAuth } from "@/middleware/auth-middleware"

export const GET = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const id = params.id
    const ingredient = await sql`
      SELECT * FROM ingredients
      WHERE id = ${id}
    `

    if (ingredient.length === 0) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 })
    }

    return NextResponse.json(ingredient[0])
  } catch (error) {
    console.error("Error fetching ingredient:", error)
    return NextResponse.json({ error: "Failed to fetch ingredient" }, { status: 500 })
  }
})

interface IngredientUpdateBody {
  name: string
  category: string
  unit: string
  currentStock: number
  reorderLevel: number
  unitCost: number
  isActive: boolean
}

interface Params {
  id: string
}

export const PUT = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: Params };
  try {
    const id = params.id
    const body: IngredientUpdateBody = await req.json()
    const { name, category, unit, currentStock, reorderLevel, unitCost, isActive } = body

    const result = await sql`
      UPDATE ingredients
      SET name = ${name},
          category = ${category},
          unit = ${unit},
          current_stock = ${currentStock},
          reorder_level = ${reorderLevel},
          unit_cost = ${unitCost},
          is_active = ${isActive},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error updating ingredient:", error)
    return NextResponse.json({ error: "Failed to update ingredient" }, { status: 500 })
  }
})

export const PATCH = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: Params };
  try {
    const id: string = params.id
    const body: Partial<IngredientUpdateBody> = await req.json()

    // Build dynamic update query based on provided fields
    const updates: string = Object.entries(body)
      .map(([key, value]) => {
        // Convert camelCase to snake_case for DB columns
        const column: string = key.replace(/([A-Z])/g, "_$1").toLowerCase()
        return `${column} = ${value}`
      })
      .join(", ")

    const query: string = `
      UPDATE ingredients
      SET ${updates}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    const result: unknown[] = await sql.query(query)

    if (result.length === 0) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error updating ingredient:", error)
    return NextResponse.json({ error: "Failed to update ingredient" }, { status: 500 })
  }
})

interface DeleteParams {
  id: string
}

export const DELETE = withAuth(async (req: NextRequest) => {
  try {
    const { params } = req as unknown as { params: DeleteParams };
    const id: string = params.id;

    await sql`
      DELETE FROM ingredients
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting ingredient:", error);
    return NextResponse.json({ error: "Failed to delete ingredient" }, { status: 500 });
  }
});
