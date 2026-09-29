"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const db_1 = require("@/lib/db");
const jwt_1 = require("@/lib/jwt");
async function GET(req) {
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
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const tableId = searchParams.get("tableId");
        const serverId = searchParams.get("serverId");
        const limit = searchParams.get("limit") ? Number.parseInt(searchParams.get("limit")) : undefined;
        let query = `
      SELECT o.*,
        (
          SELECT json_agg(
            json_build_object(
              'id', oi.id,
              'menuItemId', oi."menuItemId",
              'title', oi.title,
              'price', oi.price,
              'quantity', oi.quantity,
              'totalPrice', oi."totalPrice",
              'specialInstructions', oi."specialInstructions",
              'type', oi.type,
              'modifierSelections', (
                SELECT json_agg(
                  json_build_object(
                    'id', ms.id,
                    'modifierId', ms."modifierId",
                    'optionIds', ms."optionIds"
                  )
                )
                FROM "ModifierSelection" ms
                WHERE ms."orderItemId" = oi.id
              )
            )
          )
          FROM "OrderItem" oi
          WHERE oi."orderId" = o.id
        ) as items,
        (
          SELECT json_agg(
            json_build_object(
              'id', p.id,
              'method', p.method,
              'amount', p.amount,
              'reference', p.reference,
              'timestamp', p.timestamp
            )
          )
          FROM "Payment" p
          WHERE p."orderId" = o.id
        ) as payments,
        (
          SELECT row_to_json(t)
          FROM "Table" t
          WHERE t.id = o."tableId"
        ) as table
      FROM "Order" o
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;
        if (status) {
            query += ` AND o.status = $${paramIndex}::${'"OrderStatus"'}`;
            params.push(status);
            paramIndex++;
        }
        if (tableId) {
            query += ` AND o."tableId" = $${paramIndex}`;
            params.push(tableId);
            paramIndex++;
        }
        // If not admin or manager, only show orders for the current user
        if (!["admin", "manager"].includes(payload.role)) {
            if (payload.role === "server") {
                query += ` AND o."serverId" = $${paramIndex}`;
                params.push(payload.sub);
                paramIndex++;
            }
            else if (payload.role === "kitchen") {
                // Kitchen staff can see all pending, preparing, and ready orders
                query += ` AND o.status IN ('pending', 'preparing', 'ready')`;
            }
        }
        else if (serverId) {
            // Admin/manager can filter by server
            query += ` AND o."serverId" = ${paramIndex}`;
            params.push(serverId);
            paramIndex++;
        }
        query += ` ORDER BY o."createdAt" DESC`;
        if (limit) {
            query += ` LIMIT $${paramIndex}`;
            params.push(limit);
        }
        const orders = await db_1.sql.unsafe(query);
        return server_1.NextResponse.json(orders);
    }
    catch (error) {
        console.error("Error fetching orders:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
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
        const body = await req.json();
        // Validate required fields
        if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
            return server_1.NextResponse.json({ error: "Order must contain at least one item" }, { status: 400 });
        }
        if (!body.diningMode) {
            return server_1.NextResponse.json({ error: "Dining mode is required" }, { status: 400 });
        }
        if (body.diningMode === "DineIn" && !body.tableId) {
            return server_1.NextResponse.json({ error: "Table ID is required for dine-in orders" }, { status: 400 });
        }
        // Use the authenticated user as the server if not specified
        const serverId = body.serverId || payload.sub;
        // If tableId is provided, check if table exists and update its status
        if (body.tableId) {
            const tables = await (0, db_1.sql) `
        SELECT * FROM "Table" WHERE id = ${body.tableId}
      `;
            if (tables.length === 0) {
                return server_1.NextResponse.json({ error: "Table not found" }, { status: 404 });
            }
            // Update table status to occupied if it's not already
            if (tables[0].status !== "occupied") {
                await (0, db_1.sql) `
          UPDATE "Table" 
          SET status = 'occupied'::${'"TableStatus"'}, 
              "customerName" = ${body.customerName || null}, 
              "customerCount" = ${body.customerCount || null},
              "startTime" = NOW(),
              "updatedAt" = NOW()
          WHERE id = ${body.tableId}
        `;
            }
        }
        const orderId = crypto.randomUUID();
        // Insert order
        await (0, db_1.sql) `
      INSERT INTO "Order" (
        id, "tableId", "customerName", status, "diningMode", "serverId",
        subtotal, tax, discount, total, "isPaid", notes, "createdAt", "updatedAt"
      )
      VALUES (
        ${orderId}, ${body.tableId || null}, ${body.customerName || null},
        ${body.status || "pending"}::${'"OrderStatus"'}, ${body.diningMode}::${'"DiningMode"'},
        ${serverId}, ${body.subtotal}, ${body.tax}, ${body.discount || 0},
        ${body.total}, ${body.isPaid || false}, ${body.notes || null},
        NOW(), NOW()
      )
    `;
        // Insert order items
        for (const item of body.items) {
            const orderItemId = crypto.randomUUID();
            await (0, db_1.sql) `
        INSERT INTO "OrderItem" (
          id, "orderId", "menuItemId", title, price, quantity,
          "totalPrice", "specialInstructions", type, "createdAt", "updatedAt"
        )
        VALUES (
          ${orderItemId}, ${orderId}, ${item.menuItemId}, ${item.title},
          ${item.price}, ${item.quantity}, ${item.totalPrice},
          ${item.specialInstructions || null}, ${item.type}::${'"FoodType"'},
          NOW(), NOW()
        )
      `;
            // Insert modifier selections if provided
            if (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0) {
                for (const modifier of item.modifiers) {
                    await (0, db_1.sql) `
            INSERT INTO "ModifierSelection" (
              id, "orderItemId", "modifierId", "optionIds", "createdAt", "updatedAt"
            )
            VALUES (
              ${crypto.randomUUID()}, ${orderItemId}, ${modifier.modifierId},
              ${modifier.optionIds}, NOW(), NOW()
            )
          `;
                }
            }
        }
        // Log the action
        await (0, db_1.sql) `
      INSERT INTO "AuditLog" (
        id, "userId", action, entity, "entityId", details, timestamp
      )
      VALUES (
        ${crypto.randomUUID()}, ${payload.sub}, 
        'CREATE', 'ORDER', ${orderId}, 
        ${{
            tableId: body.tableId,
            customerName: body.customerName,
            total: body.total,
            itemCount: body.items.length,
        }}, 
        NOW()
      )
    `;
        // Fetch the created order with items and payments
        const orders = await (0, db_1.sql) `
      SELECT o.*,
        (
          SELECT json_agg(
            json_build_object(
              'id', oi.id,
              'menuItemId', oi."menuItemId",
              'title', oi.title,
              'price', oi.price,
              'quantity', oi.quantity,
              'totalPrice', oi."totalPrice",
              'specialInstructions', oi."specialInstructions",
              'type', oi.type,
              'modifierSelections', (
                SELECT json_agg(
                  json_build_object(
                    'id', ms.id,
                    'modifierId', ms."modifierId",
                    'optionIds', ms."optionIds"
                  )
                )
                FROM "ModifierSelection" ms
                WHERE ms."orderItemId" = oi.id
              )
            )
          )
          FROM "OrderItem" oi
          WHERE oi."orderId" = o.id
        ) as items,
        (
          SELECT json_agg(
            json_build_object(
              'id', p.id,
              'method', p.method,
              'amount', p.amount,
              'reference', p.reference,
              'timestamp', p.timestamp
            )
          )
          FROM "Payment" p
          WHERE p."orderId" = o.id
        ) as payments,
        (
          SELECT row_to_json(t)
          FROM "Table" t
          WHERE t.id = o."tableId"
        ) as table
      FROM "Order" o
      WHERE o.id = ${orderId}
    `;
        return server_1.NextResponse.json(orders[0], { status: 201 });
    }
    catch (error) {
        console.error("Error creating order:", error);
        return server_1.NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
}
