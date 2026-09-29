"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonalizedRecommendations = PersonalizedRecommendations;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const skeleton_1 = require("@/components/ui/skeleton");
const customer_menu_item_card_1 = require("@/components/customer/customer-menu-item-card");
function PersonalizedRecommendations({ customerId, tableNumber, onCartUpdate, }) {
    const [recommendations, setRecommendations] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        const fetchRecommendations = async () => {
            try {
                // If we have a customer ID, fetch personalized recommendations
                // Otherwise, fetch popular items
                const url = customerId
                    ? `/api/customer/recommendations?customerId=${customerId}`
                    : "/api/customer/recommendations/popular";
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error("Failed to fetch recommendations");
                }
                const data = await response.json();
                setRecommendations(data);
            }
            catch (error) {
                console.error("Error fetching recommendations:", error);
                setError("Failed to load recommendations");
            }
            finally {
                setLoading(false);
            }
        };
        fetchRecommendations();
    }, [customerId]);
    if (loading) {
        return (<card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle>
            <skeleton_1.Skeleton className="h-6 w-3/4"/>
          </card_1.CardTitle>
          <card_1.CardDescription>
            <skeleton_1.Skeleton className="h-4 w-1/2"/>
          </card_1.CardDescription>
        </card_1.CardHeader>
        <card_1.CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (<div key={i} className="flex gap-3">
                <skeleton_1.Skeleton className="h-16 w-16 rounded-md"/>
                <div className="flex-1 space-y-2">
                  <skeleton_1.Skeleton className="h-4 w-3/4"/>
                  <skeleton_1.Skeleton className="h-4 w-1/2"/>
                  <skeleton_1.Skeleton className="h-4 w-1/4"/>
                </div>
              </div>))}
          </div>
        </card_1.CardContent>
      </card_1.Card>);
    }
    if (error) {
        return (<card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle>Recommendations</card_1.CardTitle>
          <card_1.CardDescription>Based on your preferences</card_1.CardDescription>
        </card_1.CardHeader>
        <card_1.CardContent>
          <p className="text-center text-muted-foreground">{error}</p>
        </card_1.CardContent>
      </card_1.Card>);
    }
    if (recommendations.length === 0) {
        return null;
    }
    return (<card_1.Card>
      <card_1.CardHeader>
        <card_1.CardTitle>{customerId ? "Recommended for You" : "Popular Items"}</card_1.CardTitle>
        <card_1.CardDescription>
          {customerId ? "Based on your order history and preferences" : "Our most ordered items"}
        </card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent>
        <div className="space-y-4">
          {recommendations.slice(0, 3).map((item) => (<customer_menu_item_card_1.CustomerMenuItemCard key={item.id} item={item} tableNumber={tableNumber} onCartUpdate={onCartUpdate} compact/>))}
        </div>
      </card_1.CardContent>
    </card_1.Card>);
}
