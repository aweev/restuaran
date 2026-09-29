"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerFooter = CustomerFooter;
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
function CustomerFooter() {
    const searchParams = (0, navigation_1.useSearchParams)();
    const tableNumber = searchParams.get("table");
    const tableParam = tableNumber ? `?table=${tableNumber}` : "";
    return (<footer className="sticky bottom-0 z-10 bg-background border-t">
      <div className="container max-w-lg mx-auto px-4">
        <div className="grid grid-cols-4 py-2">
          <button_1.Button variant="ghost" className="flex flex-col h-auto py-2" asChild>
            <link_1.default href={`/customer/menu${tableParam}`}>
              <lucide_react_1.Menu className="h-5 w-5 mb-1"/>
              <span className="text-xs">Menu</span>
            </link_1.default>
          </button_1.Button>

          <button_1.Button variant="ghost" className="flex flex-col h-auto py-2" asChild>
            <link_1.default href={`/customer/cart${tableParam}`}>
              <lucide_react_1.ShoppingCart className="h-5 w-5 mb-1"/>
              <span className="text-xs">Cart</span>
            </link_1.default>
          </button_1.Button>

          <button_1.Button variant="ghost" className="flex flex-col h-auto py-2" asChild>
            <link_1.default href={`/customer/feedback${tableParam}`}>
              <lucide_react_1.MessageSquare className="h-5 w-5 mb-1"/>
              <span className="text-xs">Feedback</span>
            </link_1.default>
          </button_1.Button>

          <button_1.Button variant="ghost" className="flex flex-col h-auto py-2" asChild>
            <link_1.default href={`/customer/loyalty${tableParam}`}>
              <lucide_react_1.Heart className="h-5 w-5 mb-1"/>
              <span className="text-xs">Loyalty</span>
            </link_1.default>
          </button_1.Button>
        </div>
      </div>
    </footer>);
}
