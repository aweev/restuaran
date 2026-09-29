"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerAnalyticsDashboard = CustomerAnalyticsDashboard;
const card_1 = require("@/components/ui/card");
const AnalyticsContext_1 = require("@/context/AnalyticsContext");
function CustomerAnalyticsDashboard({ dateRange }) {
    const { customerData } = (0, AnalyticsContext_1.useAnalytics)();
    const COLORS = ["#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d"];
    if (!customerData) {
        return (<card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle>Customer Analytics</card_1.CardTitle>
          <card_1.CardDescription>No customer data available for the selected period</card_1.CardDescription>
        </card_1.CardHeader>
      </card_1.Card>);
    }
    // Transform visit patterns data for the heat map
    const visitPatternData = customerData.visitPatterns.map(pattern => ({
        x: pattern.dayOfWeek,
        y: pattern.hour,
        z: pattern.visitCount,
        name: `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][pattern.dayOfWeek]}, ${pattern.hour}:00`,
        value: pattern.visitCount
    }));
    return (<div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Total Customers</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{customerData.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              ${customerData.averageSpendPerCustomer.toFixed(2)} avg. spend
            </p>
          </card_1.CardContent>
        </card_1.Card>
        
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">New Customers</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{customerData.newCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {((customerData.newCustomers / customerData.totalCustomers) * 100).toFixed(1)}% of total
            </p>
          </card_1.CardContent>
        </card_1.Card>
      </div>
    </div>);
}
