"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CustomerLandingPage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const link_1 = __importDefault(require("next/link"));
const card_1 = require("@/components/ui/card");
const customer_header_1 = require("@/components/customer/customer-header");
const customer_footer_1 = require("@/components/customer/customer-footer");
const personalized_recommendations_1 = require("@/components/customer/personalized-recommendations");
const separator_1 = require("@/components/ui/separator");
const lucide_react_1 = require("lucide-react");
function CustomerLandingPage() {
    const searchParams = (0, navigation_1.useSearchParams)();
    const tableNumber = searchParams.get("table");
    const [loyaltyId, setLoyaltyId] = (0, react_1.useState)(null);
    const [lastOrderId, setLastOrderId] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        // Check if user is logged into loyalty program
        const storedLoyaltyId = localStorage.getItem("loyaltyCustomerId");
        if (storedLoyaltyId) {
            setLoyaltyId(storedLoyaltyId);
        }
        // Check if user has a recent order
        const storedOrderId = localStorage.getItem("lastOrderId");
        if (storedOrderId) {
            setLastOrderId(storedOrderId);
        }
    }, []);
    return (<div className="flex flex-col min-h-screen">
      <customer_header_1.CustomerHeader tableNumber={tableNumber} title="Welcome"/>

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <div className="space-y-6">
          {tableNumber && (<card_1.Card>
              <card_1.CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Table {tableNumber}</h2>
                    <p className="text-sm text-muted-foreground">You&apos;re seated at table {tableNumber}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <lucide_react_1.Utensils className="h-6 w-6"/>
                  </div>
                </div>
              </card_1.CardContent>
            </card_1.Card>)}

          <div className="grid grid-cols-2 gap-4">
            <card_1.Card className="col-span-2">
              <card_1.CardContent className="pt-6">
                <link_1.default href={`/customer/menu${tableNumber ? `?table=${tableNumber}` : ""}`} className="block">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">View Menu</h3>
                      <p className="text-sm text-muted-foreground">Browse our delicious offerings</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <lucide_react_1.QrCode className="h-5 w-5"/>
                    </div>
                  </div>
                </link_1.default>
              </card_1.CardContent>
            </card_1.Card>

            <card_1.Card>
              <card_1.CardContent className="pt-6">
                <link_1.default href={`/customer/cart${tableNumber ? `?table=${tableNumber}` : ""}`} className="block">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <lucide_react_1.ShoppingCart className="h-5 w-5"/>
                    </div>
                    <h3 className="font-medium">Your Cart</h3>
                  </div>
                </link_1.default>
              </card_1.CardContent>
            </card_1.Card>

            {lastOrderId && (<card_1.Card>
                <card_1.CardContent className="pt-6">
                  <link_1.default href={`/customer/order-tracking?orderId=${lastOrderId}${tableNumber ? `&table=${tableNumber}` : ""}`} className="block">
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <lucide_react_1.Clock className="h-5 w-5"/>
                      </div>
                      <h3 className="font-medium">Track Order</h3>
                    </div>
                  </link_1.default>
                </card_1.CardContent>
              </card_1.Card>)}

            <card_1.Card className={!lastOrderId ? "col-span-2" : ""}>
              <card_1.CardContent className="pt-6">
                <link_1.default href={`/customer/feedback${tableNumber ? `?table=${tableNumber}` : ""}`} className="block">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <lucide_react_1.MessageSquare className="h-5 w-5"/>
                    </div>
                    <h3 className="font-medium">Feedback</h3>
                  </div>
                </link_1.default>
              </card_1.CardContent>
            </card_1.Card>

            <card_1.Card className="col-span-2">
              <card_1.CardContent className="pt-6">
                <link_1.default href={`/customer/loyalty${tableNumber ? `?table=${tableNumber}` : ""}`} className="block">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Loyalty Program</h3>
                      <p className="text-sm text-muted-foreground">
                        {loyaltyId ? "View your rewards" : "Join and earn points"}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <lucide_react_1.Heart className="h-5 w-5"/>
                    </div>
                  </div>
                </link_1.default>
              </card_1.CardContent>
            </card_1.Card>
          </div>

          <separator_1.Separator />

          <personalized_recommendations_1.PersonalizedRecommendations customerId={loyaltyId || undefined} tableNumber={tableNumber || undefined}/>
        </div>
      </main>

      <customer_footer_1.CustomerFooter />
    </div>);
}
