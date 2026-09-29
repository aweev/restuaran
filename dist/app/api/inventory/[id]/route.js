"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.PATCH = exports.PUT = exports.GET = void 0;
const server_1 = require("next/server");
const db_1 = require("@/lib/db");
const auth_middleware_1 = require("@/middleware/auth-middleware");
exports.GET = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const id = params.id;
        const ingredient = await (0, db_1.sql) `
      SELECT * FROM ingredients
      WHERE id = ${id}
    `;
        if (ingredient.length === 0) {
            return server_1.NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
        }
        return server_1.NextResponse.json(ingredient[0]);
    }
    catch (error) {
        console.error("Error fetching ingredient:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch ingredient" }, { status: 500 });
    }
});
exports.PUT = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const id = params.id;
        const body = await req.json();
        const { name, category, unit, currentStock, reorderLevel, unitCost, isActive } = body;
        const result = await (0, db_1.sql) `
      UPDATE ingredients
      SET name = ${name},
          category = ${category},
          unit = ${unit},
          current_stock = ${currentStock},
          reorder_level = ${reorderLevel},
          unit_cost = ${unitCost},
          is_active = ${isActive},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
        if (result.length === 0) {
            return server_1.NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
        }
        return server_1.NextResponse.json(result[0]);
    }
    catch (error) {
        console.error("Error updating ingredient:", error);
        return server_1.NextResponse.json({ error: "Failed to update ingredient" }, { status: 500 });
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
      UPDATE ingredients
      SET ${updates}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
        const result = await db_1.sql.query(query);
        if (result.length === 0) {
            return server_1.NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
        }
        return server_1.NextResponse.json(result[0]);
    }
    catch (error) {
        console.error("Error updating ingredient:", error);
        return server_1.NextResponse.json({ error: "Failed to update ingredient" }, { status: 500 });
    }
});
exports.DELETE = (0, auth_middleware_1.withAuth)(async (req) => {
    try {
        const { params } = req;
        const id = params.id;
        await (0, db_1.sql) `
      DELETE FROM ingredients
      WHERE id = ${id}
    `;
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        console.error("Error deleting ingredient:", error);
        return server_1.NextResponse.json({ error: "Failed to delete ingredient" }, { status: 500 });
    }
});
