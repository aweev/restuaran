"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerHeader = CustomerHeader;
const link_1 = __importDefault(require("next/link"));
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
function CustomerHeader({ tableNumber, showBackButton = false, title }) {
    const tableParam = tableNumber ? `?table=${tableNumber}` : "";
    return (<header className="sticky top-0 z-10 bg-background border-b">
      <div className="container max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showBackButton ? (<button_1.Button variant="ghost" size="icon" asChild>
              <link_1.default href={`/customer/menu${tableParam}`}>
                <lucide_react_1.ArrowLeft className="h-5 w-5"/>
              </link_1.default>
            </button_1.Button>) : (<button_1.Button variant="ghost" size="icon" asChild>
              <link_1.default href={`/customer${tableParam}`}>
                <lucide_react_1.Home className="h-5 w-5"/>
              </link_1.default>
            </button_1.Button>)}

          <div>
            <h1 className="text-lg font-medium">{title || "Restaurant Name"}</h1>
            {tableNumber && <p className="text-xs text-muted-foreground">Table {tableNumber}</p>}
          </div>
        </div>

        <div>{/* Additional header elements can go here */}</div>
      </div>
    </header>);
}
