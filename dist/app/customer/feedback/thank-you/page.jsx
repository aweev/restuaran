"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = FeedbackThankYouPage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const link_1 = __importDefault(require("next/link"));
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const customer_header_1 = require("@/components/customer/customer-header");
const customer_footer_1 = require("@/components/customer/customer-footer");
const lucide_react_1 = require("lucide-react");
function FeedbackThankYouPage() {
    const searchParams = (0, navigation_1.useSearchParams)();
    const tableNumber = searchParams.get("table");
    (0, react_1.useEffect)(() => {
        // Clear any stored order ID since feedback has been submitted
        localStorage.removeItem("lastOrderId");
    }, []);
    return (<div className="flex flex-col min-h-screen">
      <customer_header_1.CustomerHeader tableNumber={tableNumber} showBackButton title="Thank You"/>

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6 flex items-center justify-center">
        <card_1.Card className="w-full">
          <card_1.CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <lucide_react_1.CheckCircle2 className="h-8 w-8 text-green-600"/>
            </div>
            <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
            <p className="text-muted-foreground mb-4">
              We appreciate your feedback. It helps us improve our service and provide a better dining experience.
            </p>
          </card_1.CardContent>
          <card_1.CardFooter className="flex justify-center">
            <button_1.Button asChild>
              <link_1.default href={`/customer${tableNumber ? `?table=${tableNumber}` : ""}`}>Return to Home</link_1.default>
            </button_1.Button>
          </card_1.CardFooter>
        </card_1.Card>
      </main>

      <customer_footer_1.CustomerFooter />
    </div>);
}
