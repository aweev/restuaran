"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const server_1 = require("next/server");
const db_1 = require("@/lib/db");
const auth_middleware_1 = require("@/middleware/auth-middleware");
const route_1 = require("@/app/api/socket/route");
exports.GET = (0, auth_middleware_1.withAuth)(async () => {
    try {
        const reservations = await (0, db_1.sql) `
      SELECT * FROM reservations
      ORDER BY date DESC, time ASC
    `;
        return server_1.NextResponse.json(reservations);
    }
    catch (error) {
        console.error("Error fetching reservations:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch reservations" }, { status: 500 });
    }
});
exports.POST = (0, auth_middleware_1.withAuth)(async (req) => {
    try {
        const body = await req.json();
        const { customerName, phone, email, partySize, tableId, date, time, status, notes } = body;
        const result = await (0, db_1.sql) `
      INSERT INTO reservations (
        customer_name, phone, email, party_size, table_id, 
        date, time, status, notes
      )
      VALUES (
        ${customerName}, ${phone}, ${email}, ${partySize}, ${tableId}, 
        ${date}, ${time}, ${status || "confirmed"}, ${notes || ""}
      )
      RETURNING *
    `;
        const newReservation = result[0];
        // Emit WebSocket event for real-time updates
        (0, route_1.emitToRoom)("global", "reservation:new", newReservation);
        return server_1.NextResponse.json(newReservation);
    }
    catch (error) {
        console.error("Error creating reservation:", error);
        return server_1.NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
    }
});
