import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")
    const available = searchParams.get("available")

    let query = `
      SELECT m.*, 
        (
          SELECT json_agg(
            json_build_object(
              'id', mm.id,
              'name', mm.name,
              'required', mm.required,
              'multiple', mm.multiple,
              'options', (
                SELECT json_agg(
                  json_build_object(
                    'id', mmo.id,
                    'name', mmo.name,
                    'price', mmo.price
                  )
                )
                FROM "MenuItemModifierOption" mmo
                WHERE mmo."modifierId" = mm.id
              )
            )
          )
          FROM "MenuItemModifier" mm
          WHERE mm."menuItemId" = m.id
        ) as modifiers
      FROM "MenuItem" m
      WHERE 1=1
    `

    const params: unknown[] = []

    if (category && category !== "all") {
      query += ` AND m.category = $${params.length + 1}`
      params.push(category)
    }

    if (available !== null) {
      query += ` AND m.available = $${params.length + 1}`
      params.push(available === "true")
    }

    query += ` ORDER BY m.title ASC`

    const menuItems = await sql.unsafe(query)

    return NextResponse.json(menuItems)
  } catch (error) {
    console.error("Error fetching menu items:", error)
    return NextResponse.json({ error: "Failed to fetch menu items" }, { status: 500 })
  }
}