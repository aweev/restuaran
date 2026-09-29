"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const server_1 = require("next/server");
const db_1 = require("@/lib/db");
const auth_middleware_1 = require("@/middleware/auth-middleware");
exports.GET = (0, auth_middleware_1.withAuth)(async () => {
    try {
        const ingredients = await (0, db_1.sql) `
      SELECT * FROM ingredients
      ORDER BY name ASC
    `;
        return server_1.NextResponse.json(ingredients);
    }
    catch (error) {
        console.error("Error fetching ingredients:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch ingredients" }, { status: 500 });
    }
});
exports.POST = (0, auth_middleware_1.withAuth)(async (req) => {
    try {
        const body = await req.json();
        const { name, category, unit, currentStock, reorderLevel, unitCost, isActive } = body;
        const result = await (0, db_1.sql) `
      INSERT INTO ingredients (name, category, unit, current_stock, reorder_level, unit_cost, is_active)
      VALUES (${name}, ${category}, ${unit}, ${currentStock}, ${reorderLevel}, ${unitCost}, ${isActive})
      RETURNING *
    `;
        return server_1.NextResponse.json(result[0]);
    }
    catch (error) {
        console.error("Error creating ingredient:", error);
        return server_1.NextResponse.json({ error: "Failed to create ingredient" }, { status: 500 });
    }
});
