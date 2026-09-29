"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KitchenOrderQueue = KitchenOrderQueue;
const react_1 = require("react");
const KitchenContext_1 = require("@/context/KitchenContext");
const scroll_area_1 = require("@/components/ui/scroll-area");
const kitchen_order_card_1 = require("@/components/kitchen/kitchen-order-card");
const kitchen_order_details_1 = require("@/components/kitchen/kitchen-order-details");
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
const dropdown_menu_1 = require("@/components/ui/dropdown-menu");
function KitchenOrderQueue({ orders, status }) {
    const [selectedOrder, setSelectedOrder] = (0, react_1.useState)(null);
    const [sortBy, setSortBy] = (0, react_1.useState)("time");
    const { state } = (0, KitchenContext_1.useKitchen)();
    // Calculate estimated preparation time for an order
    const calculatePrepTime = (order) => {
        let totalTime = 0;
        for (const item of order.items) {
            const itemPrepTime = state.preparationTimes[item.menuItemId] || 5; // Default to 5 minutes if not set
            totalTime = Math.max(totalTime, itemPrepTime * item.quantity);
        }
        return totalTime;
    };
    // Sort orders based on selected sort option
    const sortedOrders = [...orders].sort((a, b) => {
        switch (sortBy) {
            case "time":
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            case "priority":
                // Priority based on preparation time and wait time
                const aWaitTime = (Date.now() - new Date(a.createdAt).getTime()) / 60000; // in minutes
                const bWaitTime = (Date.now() - new Date(b.createdAt).getTime()) / 60000; // in minutes
                const aPrepTime = calculatePrepTime(a);
                const bPrepTime = calculatePrepTime(b);
                const aPriority = aWaitTime / aPrepTime;
                const bPriority = bWaitTime / bPrepTime;
                return bPriority - aPriority; // Higher priority first
            case "table":
                // Sort by table number if available, otherwise by customer name
                if (a.tableId && b.tableId) {
                    return a.tableId.localeCompare(b.tableId);
                }
                else if (a.tableId) {
                    return -1;
                }
                else if (b.tableId) {
                    return 1;
                }
                else {
                    return (a.customerName || "").localeCompare(b.customerName || "");
                }
            default:
                return 0;
        }
    });
    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
    };
    const handleCloseDetails = () => {
        setSelectedOrder(null);
    };
    return (<div className="relative h-full">
      <div className="flex items-center justify-between border-b p-2">
        <div className="flex items-center gap-2">
          <lucide_react_1.Clock className="h-4 w-4 text-muted-foreground"/>
          <span className="text-sm text-muted-foreground">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </span>
        </div>
        <dropdown_menu_1.DropdownMenu>
          <dropdown_menu_1.DropdownMenuTrigger asChild>
            <button_1.Button variant="ghost" size="sm">
              <lucide_react_1.Filter className="mr-2 h-4 w-4"/>
              Sort
            </button_1.Button>
          </dropdown_menu_1.DropdownMenuTrigger>
          <dropdown_menu_1.DropdownMenuContent align="end">
            <dropdown_menu_1.DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => setSortBy(value)}>
              <dropdown_menu_1.DropdownMenuRadioItem value="time">Time Received</dropdown_menu_1.DropdownMenuRadioItem>
              <dropdown_menu_1.DropdownMenuRadioItem value="priority">Priority</dropdown_menu_1.DropdownMenuRadioItem>
              <dropdown_menu_1.DropdownMenuRadioItem value="table">Table Number</dropdown_menu_1.DropdownMenuRadioItem>
            </dropdown_menu_1.DropdownMenuRadioGroup>
          </dropdown_menu_1.DropdownMenuContent>
        </dropdown_menu_1.DropdownMenu>
      </div>

      {orders.length === 0 ? (<div className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted-foreground">No orders</p>
        </div>) : (<scroll_area_1.ScrollArea className="h-[calc(100vh-20rem)]">
          <div className="space-y-2 p-2">
            {sortedOrders.map((order) => (<kitchen_order_card_1.KitchenOrderCard key={order.id} order={order} onSelect={() => handleSelectOrder(order)} prepTime={calculatePrepTime(order)}/>))}
          </div>
        </scroll_area_1.ScrollArea>)}

      {selectedOrder && (<kitchen_order_details_1.KitchenOrderDetails order={selectedOrder} onClose={handleCloseDetails} prepTime={calculatePrepTime(selectedOrder)}/>)}
    </div>);
}
