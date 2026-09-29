"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LowStockAlert = LowStockAlert;
const alert_1 = require("@/components/ui/alert");
const lucide_react_1 = require("lucide-react");
const button_1 = require("@/components/ui/button");
function LowStockAlert({ ingredients }) {
    if (ingredients.length === 0)
        return null;
    return (<alert_1.Alert variant="destructive">
      <lucide_react_1.AlertCircle className="h-4 w-4"/>
      <alert_1.AlertTitle>Low Stock Alert</alert_1.AlertTitle>
      <alert_1.AlertDescription className="flex flex-col gap-2">
        <p>
          {ingredients.length} ingredient{ingredients.length > 1 ? "s" : ""} need to be reordered:
        </p>
        <ul className="list-disc pl-5">
          {ingredients.slice(0, 3).map((ingredient) => (<li key={ingredient.id}>
              {ingredient.name}: {ingredient.currentStock} {ingredient.unit} remaining (below reorder level of{" "}
              {ingredient.reorderLevel})
            </li>))}
          {ingredients.length > 3 && <li>And {ingredients.length - 3} more...</li>}
        </ul>
        <div className="mt-2">
          <button_1.Button size="sm" variant="outline">
            Generate Purchase Order
          </button_1.Button>
        </div>
      </alert_1.AlertDescription>
    </alert_1.Alert>);
}
