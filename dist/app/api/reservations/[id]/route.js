"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.PATCH = exports.PUT = exports.GET = void 0;
const server_1 = require("next/server");
const db_1 = require("@/lib/db");
const auth_middleware_1 = require("@/middleware/auth-middleware");
const route_1 = require("@/app/api/socket/route");
exports.GET = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const id = params.id;
        const reservation = (await (0, db_1.sql) `
      SELECT * FROM reservations
      WHERE id = ${id}
    `);
        if (reservation.length === 0) {
            return server_1.NextResponse.json({ error: "Reservation not found" }, { status: 404 });
        }
        return server_1.NextResponse.json(reservation[0]);
    }
    catch (error) {
        console.error("Error fetching reservation:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch reservation" }, { status: 500 });
    }
});
exports.PUT = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const id = params.id;
        const body = await req.json();
        const { customerName, phone, email, partySize, tableId, date, time, status, notes } = body;
        const result = (await (0, db_1.sql) `
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
    `);
        if (result.length === 0) {
            return server_1.NextResponse.json({ error: "Reservation not found" }, { status: 404 });
        }
        const updatedReservation = result[0];
        // Emit WebSocket event for real-time updates
        (0, route_1.emitToRoom)("global", "reservation:update", updatedReservation);
        return server_1.NextResponse.json(updatedReservation);
    }
    catch (error) {
        console.error("Error updating reservation:", error);
        return server_1.NextResponse.json({ error: "Failed to update reservation" }, { status: 500 });
    }
});
exports.PATCH = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const id = params.id;
        const body = await req.json();
        // Build dynamic update query based on provided fields
        const updates = Object.entries(body)
            .map(([key, value]) => {
            // Convert camelCase to snake_case for DB columns
            const column = key.replace(/([A-Z])/g, "_$1").toLowerCase();
            return `${column} = ${value}`;
        })
            .join(", ");
        const query = `
      UPDATE reservations
      SET ${updates}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
        const result = await db_1.sql.query(query);
        if (result.length === 0) {
            return server_1.NextResponse.json({ error: "Reservation not found" }, { status: 404 });
        }
        const updatedReservation = result[0];
        // Emit WebSocket event for real-time updates
        (0, route_1.emitToRoom)("global", "reservation:update", updatedReservation);
        return server_1.NextResponse.json(updatedReservation);
    }
    catch (error) {
        console.error("Error updating reservation:", error);
        return server_1.NextResponse.json({ error: "Failed to update reservation" }, { status: 500 });
    }
});
exports.DELETE = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const id = params.id;
        await (0, db_1.sql) `
      DELETE FROM reservations
      WHERE id = ${id}
    `;
        // Emit WebSocket event for real-time updates
        (0, route_1.emitToRoom)("global", "reservation:delete", { id });
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        console.error("Error deleting reservation:", error);
        return server_1.NextResponse.json({ error: "Failed to delete reservation" }, { status: 500 });
    }
});
