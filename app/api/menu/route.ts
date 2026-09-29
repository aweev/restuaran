import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getTokenFromRequest, verifyJWT } from "@/lib/jwt"

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

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const token = getTokenFromRequest(req)
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Check permissions (only admin and manager can create menu items)
    if (!["admin", "manager"].includes(payload.role as string)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()

    // Validate required fields
    if (!body.title || !body.description || !body.price || !body.category || !body.type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const id = crypto.randomUUID()

    // Insert menu item
    await sql`
      INSERT INTO "MenuItem" (
        id, title, description, price, image, category, type, 
        available, discount, popular, allergens, calories, 
        protein, carbs, fat, "createdAt", "updatedAt"
      )
      VALUES (
        ${id}, ${body.title}, ${body.description}, ${body.price}, 
        ${body.image || "/placeholder.svg?height=300&width=300"}, 
        ${body.category}, ${body.type}::${'"FoodType"'}, 
        ${body.available !== undefined ? body.available : true}, 
        ${body.discount || null}, 
        ${body.popular || false}, 
        ${body.allergens || []}, 
        ${body.calories || null}, 
        ${body.protein || null}, 
        ${body.carbs || null}, 
        ${body.fat || null}, 
        NOW(), NOW()
      )
    `

    // Insert modifiers if provided
    if (body.modifiers && Array.isArray(body.modifiers) && body.modifiers.length > 0) {
      for (const modifier of body.modifiers) {
        const modifierId = crypto.randomUUID()

        await sql`
          INSERT INTO "MenuItemModifier" (
            id, name, required, multiple, "menuItemId", "createdAt", "updatedAt"
          )
          VALUES (
            ${modifierId}, ${modifier.name}, 
            ${modifier.required || false}, 
            ${modifier.multiple || false}, 
            ${id}, NOW(), NOW()
          )
        `

        // Insert options for this modifier
        if (modifier.options && Array.isArray(modifier.options)) {
          for (const option of modifier.options) {
            await sql`
              INSERT INTO "MenuItemModifierOption" (
                id, name, price, "modifierId", "createdAt", "updatedAt"
              )
              VALUES (
                ${crypto.randomUUID()}, ${option.name}, 
                ${option.price || 0}, ${modifierId}, 
                NOW(), NOW()
              )
            `
          }
        }
      }
    }

    // Log the action
    await sql`
      INSERT INTO "AuditLog" (
        id, "userId", action, entity, "entityId", details, timestamp
      )
      VALUES (
        ${crypto.randomUUID()}, ${payload.sub}, 
        'CREATE', 'MENU_ITEM', ${id}, 
        ${{ title: body.title }}, NOW()
      )
    `

    // Fetch the created menu item with modifiers
    const menuItems = await sql.unsafe(
      `
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
      WHERE m.id = '${id}'
    `
    ) as unknown as unknown[]

    return NextResponse.json(menuItems[0], { status: 201 })
  } catch (error) {
    console.error("Error creating menu item:", error)
    return NextResponse.json({ error: "Failed to create menu item" }, { status: 500 })
  }
}
