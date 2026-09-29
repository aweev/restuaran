import { NextResponse, NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { withAuth } from "@/middleware/auth-middleware"
import { emitToRoom } from "@/lib/socket-registry"

interface Reservation {
  id: string
  customer_name: string
  phone: string
  email: string
  party_size: number
  table_id: string
  date: string
  time: string
  status: string
  notes: string | null
  updated_at: string
  created_at: string
}

export const GET = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const id = params.id
    const reservation = (await sql`
      SELECT * FROM reservations
      WHERE id = ${id}
    `) as unknown as Reservation[]

    if (reservation.length === 0) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    return NextResponse.json(reservation[0])
  } catch (error) {
    console.error("Error fetching reservation:", error)
    return NextResponse.json({ error: "Failed to fetch reservation" }, { status: 500 })
  }
})

interface UpdateReservationRequestBody {
  customerName: string
  phone: string
  email: string
  partySize: number
  tableId: string
  date: string
  time: string
  status: string
  notes: string | null
}

export const PUT = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const id: string = params.id
    const body: UpdateReservationRequestBody = await req.json()
    const { customerName, phone, email, partySize, tableId, date, time, status, notes } = body

    const result = (await sql`
      UPDATE reservations
      SET customer_name = ${customerName},
          phone = ${phone},
          email = ${email},
          party_size = ${partySize},
          table_id = ${tableId},
          date = ${date},
          time = ${time},
          status = ${status},
          notes = ${notes},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `) as unknown as Reservation[]

    if (result.length === 0) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    const updatedReservation: Reservation = result[0]

    // Emit WebSocket event for real-time updates
    emitToRoom("global", "reservation:update", updatedReservation)

    return NextResponse.json(updatedReservation)
  } catch (error) {
    console.error("Error updating reservation:", error)
    return NextResponse.json({ error: "Failed to update reservation" }, { status: 500 })
  }
})

export const PATCH = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: { id: string } };
  try {
    const id = params.id
    const body = await req.json()

    // Build dynamic update query based on provided fields
    const updates = Object.entries(body)
      .map(([key, value]) => {
        // Convert camelCase to snake_case for DB columns
        const column = key.replace(/([A-Z])/g, "_$1").toLowerCase()
        return `${column} = ${value}`
      })
      .join(", ")

    const query = `
      UPDATE reservations
      SET ${updates}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    const result = await sql.query(query)

    if (result.length === 0) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    const updatedReservation = result[0]

    // Emit WebSocket event for real-time updates
    emitToRoom("global", "reservation:update", updatedReservation)

    return NextResponse.json(updatedReservation)
  } catch (error) {
    console.error("Error updating reservation:", error)
    return NextResponse.json({ error: "Failed to update reservation" }, { status: 500 })
  }
})

interface DeleteReservationParams {
  id: string
}

export const DELETE = withAuth(async (req: NextRequest) => {
  const { params } = req as unknown as { params: DeleteReservationParams };
  try {
    const id = params.id

    await sql`
      DELETE FROM reservations
      WHERE id = ${id}
    `

    // Emit WebSocket event for real-time updates
    emitToRoom("global", "reservation:delete", { id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting reservation:", error)
    return NextResponse.json({ error: "Failed to delete reservation" }, { status: 500 })
  }
})
