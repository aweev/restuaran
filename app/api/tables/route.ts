import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getTokenFromRequest, verifyJWT } from "@/lib/jwt"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    let query = `SELECT * FROM "Table"`
    const params: unknown[] = []

    if (status) {
      query += ` WHERE status = $1::${'"TableStatus"'}`
      params.push(status)
    }

    query += ` ORDER BY number ASC`

    const tables = await sql.unsafe(
      params.length > 0 ? query.replace("$1", `'${params[0]}'`) : query
    )

    return NextResponse.json(tables)
  } catch (error) {
    console.error("Error fetching tables:", error)
    return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 })
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

    // Check permissions (only admin and manager can create tables)
    if (!["admin", "manager"].includes(payload.role as string)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()

    // Validate required fields
    if (!body.number || !body.capacity || body.positionX === undefined || body.positionY === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if table number already exists
    const existingTables = await sql`
      SELECT * FROM "Table" WHERE number = ${body.number}
    `

    if (existingTables.length > 0) {
      return NextResponse.json({ error: "Table number already exists" }, { status: 400 })
    }

    const id = crypto.randomUUID()

    // Insert table
    await sql`
      INSERT INTO "Table" (
        id, number, capacity, status, "customerName", "customerCount",
        "startTime", "serverName", "positionX", "positionY", "createdAt", "updatedAt"
      )
      VALUES (
        ${id}, ${body.number}, ${body.capacity}, 
        ${body.status || "available"}::${'"TableStatus"'}, 
        ${body.customerName || null}, ${body.customerCount || null},
        ${body.startTime ? new Date(body.startTime) : null}, 
        ${body.serverName || null}, 
        ${body.positionX}, ${body.positionY}, 
        NOW(), NOW()
      )
    `

    // Log the action
    await sql`
      INSERT INTO "AuditLog" (
        id, "userId", action, entity, "entityId", details, timestamp
      )
      VALUES (
        ${crypto.randomUUID()}, ${payload.sub}, 
        'CREATE', 'TABLE', ${id}, 
        ${{ number: body.number }}, NOW()
      )
    `

    // Fetch the created table
    const tables = await sql`
      SELECT * FROM "Table" WHERE id = ${id}
    `

    return NextResponse.json(tables[0], { status: 201 })
  } catch (error) {
    console.error("Error creating table:", error)
    return NextResponse.json({ error: "Failed to create table" }, { status: 500 })
  }
}
