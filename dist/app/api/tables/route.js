"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const db_1 = require("@/lib/db");
const jwt_1 = require("@/lib/jwt");
async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        let query = `SELECT * FROM "Table"`;
        const params = [];
        if (status) {
            query += ` WHERE status = $1::${'"TableStatus"'}`;
            params.push(status);
        }
        query += ` ORDER BY number ASC`;
        const tables = await db_1.sql.unsafe(params.length > 0 ? query.replace("$1", `'${params[0]}'`) : query);
        return server_1.NextResponse.json(tables);
    }
    catch (error) {
        console.error("Error fetching tables:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 });
    }
}
async function POST(req) {
    try {
        // Verify authentication
        const token = (0, jwt_1.getTokenFromRequest)(req);
        if (!token) {
            return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const payload = await (0, jwt_1.verifyJWT)(token);
        if (!payload) {
            return server_1.NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }
        // Check permissions (only admin and manager can create tables)
        if (!["admin", "manager"].includes(payload.role)) {
            return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const body = await req.json();
        // Validate required fields
        if (!body.number || !body.capacity || body.positionX === undefined || body.positionY === undefined) {
            return server_1.NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        // Check if table number already exists
        const existingTables = await (0, db_1.sql) `
      SELECT * FROM "Table" WHERE number = ${body.number}
    `;
        if (existingTables.length > 0) {
            return server_1.NextResponse.json({ error: "Table number already exists" }, { status: 400 });
        }
        const id = crypto.randomUUID();
        // Insert table
        await (0, db_1.sql) `
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
    `;
        // Log the action
        await (0, db_1.sql) `
      INSERT INTO "AuditLog" (
        id, "userId", action, entity, "entityId", details, timestamp
      )
      VALUES (
        ${crypto.randomUUID()}, ${payload.sub}, 
        'CREATE', 'TABLE', ${id}, 
        ${{ number: body.number }}, NOW()
      )
    `;
        // Fetch the created table
        const tables = await (0, db_1.sql) `
      SELECT * FROM "Table" WHERE id = ${id}
    `;
        return server_1.NextResponse.json(tables[0], { status: 201 });
    }
    catch (error) {
        console.error("Error creating table:", error);
        return server_1.NextResponse.json({ error: "Failed to create table" }, { status: 500 });
    }
}
