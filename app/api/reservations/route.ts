import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { withAuth } from "@/middleware/auth-middleware"
import { emitToRoom } from "@/lib/socket-registry"

export const GET = withAuth(async () => {
  try {
    const reservations = await sql`
      SELECT * FROM reservations
      ORDER BY date DESC, time ASC
    `

    return NextResponse.json(reservations)
  } catch (error) {
    console.error("Error fetching reservations:", error)
    return NextResponse.json({ error: "Failed to fetch reservations" }, { status: 500 })
  }
})

export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json()
    const { customerName, phone, email, partySize, tableId, date, time, status, notes } = body

    const result = await sql`
      INSERT INTO reservations (
        customer_name, phone, email, party_size, table_id, 
        date, time, status, notes
      )
      VALUES (
        ${customerName}, ${phone}, ${email}, ${partySize}, ${tableId}, 
        ${date}, ${time}, ${status || "confirmed"}, ${notes || ""}
      )
      RETURNING *
    `

    const newReservation = result[0]

    // Emit WebSocket event for real-time updates
    emitToRoom("global", "reservation:new", newReservation)

    return NextResponse.json(newReservation)
  } catch (error) {
    console.error("Error creating reservation:", error)
    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 })
  }
})
