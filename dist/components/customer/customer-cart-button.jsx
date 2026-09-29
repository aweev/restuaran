"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerCartButton = CustomerCartButton;
const link_1 = __importDefault(require("next/link"));
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
function CustomerCartButton({ count, tableNumber }) {
    const tableParam = tableNumber ? `?table=${tableNumber}` : "";
    return (<div className="fixed bottom-20 right-4 z-20">
      <button_1.Button size="lg" className="rounded-full h-14 w-14 shadow-lg" asChild>
        <link_1.default href={`/customer/cart${tableParam}`}>
          <lucide_react_1.ShoppingCart className="h-6 w-6"/>
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
            {count > 99 ? "99+" : count}
          </span>
        </link_1.default>
      </button_1.Button>
    </div>);
}
