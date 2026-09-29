"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableServiceTracker = TableServiceTracker;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const scroll_area_1 = require("@/components/ui/scroll-area");
const progress_1 = require("@/components/ui/progress");
const dialog_1 = require("@/components/ui/dialog");
const tabs_1 = require("@/components/ui/tabs");
const date_fns_1 = require("date-fns");
const lucide_react_1 = require("lucide-react");
const OrderContext_1 = require("@/context/OrderContext");
function TableServiceTracker({ tables }) {
    const { state: orderState } = (0, OrderContext_1.useOrder)();
    const [currentTime, setCurrentTime] = (0, react_1.useState)(new Date());
    const [selectedTable, setSelectedTable] = (0, react_1.useState)(null);
    const [isDetailsOpen, setIsDetailsOpen] = (0, react_1.useState)(false);
    // Update current time every minute
    (0, react_1.useEffect)(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        return () => clearInterval(interval);
    }, []);
    // Get occupied tables with their orders
    const occupiedTables = tables
        .filter((table) => table.status === "occupied")
        .map((table) => {
        const tableOrders = orderState.orders.filter((order) => order.tableId === table.id && ["pending", "preparing", "ready"].includes(order.status));
        return Object.assign(Object.assign({}, table), { orders: tableOrders, serviceTime: table.startTime ? (0, date_fns_1.differenceInMinutes)(currentTime, new Date(table.startTime)) : 0 });
    })
        .sort((a, b) => b.serviceTime - a.serviceTime);
    // Get service time status
    const getServiceTimeStatus = (minutes) => {
        if (minutes < 30)
            return "normal";
        if (minutes < 60)
            return "medium";
        return "long";
    };
    // Get service time color
    const getServiceTimeColor = (status) => {
        switch (status) {
            case "normal":
                return "bg-green-100 text-green-800";
            case "medium":
                return "bg-yellow-100 text-yellow-800";
            case "long":
                return "bg-red-100 text-red-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };
    // Format service time
    const formatServiceTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };
    // Get order status color
    const getOrderStatusColor = (status) => {
        switch (status) {
            case "pending":
                return "bg-yellow-100 text-yellow-800";
            case "preparing":
                return "bg-blue-100 text-blue-800";
            case "ready":
                return "bg-green-100 text-green-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };
    // Calculate order progress
    const calculateOrderProgress = (order) => {
        const createdAt = new Date(order.createdAt);
        const now = new Date();
        // Estimate total preparation time based on number of items (2 minutes per item)
        const estimatedPrepTime = Math.max(5, order.items.length * 2);
        // Calculate elapsed time in minutes
        const elapsedMinutes = (0, date_fns_1.differenceInMinutes)(now, createdAt);
        // Calculate progress percentage (capped at 100%)
        return Math.min(100, Math.round((elapsedMinutes / estimatedPrepTime) * 100));
    };
    return (<div className="space-y-4">
      <scroll_area_1.ScrollArea className="h-[500px]">
        {occupiedTables.length === 0 ? (<div className="flex h-32 items-center justify-center text-muted-foreground">
            No tables currently occupied
          </div>) : (<div className="space-y-2">
            {occupiedTables.map((table) => {
                const serviceTimeStatus = getServiceTimeStatus(table.serviceTime);
                return (<card_1.Card key={table.id} className={`border-l-4 ${serviceTimeStatus === "long"
                        ? "border-l-red-500"
                        : serviceTimeStatus === "medium"
                            ? "border-l-yellow-500"
                            : "border-l-green-500"}`}>
                  <card_1.CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">Table {table.number}</h4>
                          <badge_1.Badge variant="outline" className={getServiceTimeColor(serviceTimeStatus)}>
                            {formatServiceTime(table.serviceTime)}
                          </badge_1.Badge>
                          {serviceTimeStatus === "long" && <lucide_react_1.AlertTriangle className="h-4 w-4 text-red-500"/>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <span>{table.customerName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>{table.customerCount} guests</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <lucide_react_1.Clock className="h-4 w-4"/>
                            <span>
                              Seated at {table.startTime ? (0, date_fns_1.format)(new Date(table.startTime), "h:mm a") : "N/A"}
                            </span>
                          </div>
                        </div>

                        {table.orders.length > 0 && (<div className="mt-2 space-y-2">
                            {table.orders.map((order) => (<div key={order.id} className="flex items-center gap-2">
                                <badge_1.Badge variant="outline" className={getOrderStatusColor(order.status)}>
                                  {order.status}
                                </badge_1.Badge>
                                <progress_1.Progress value={calculateOrderProgress(order)} className="h-2 w-24"/>
                                <span className="text-xs text-muted-foreground">{order.items.length} items</span>
                              </div>))}
                          </div>)}
                      </div>
                      <div>
                        <dialog_1.Dialog>
                          <dialog_1.DialogTrigger asChild>
                            <button_1.Button variant="outline" onClick={() => {
                        setSelectedTable(table);
                        setIsDetailsOpen(true);
                    }}>
                              Details
                            </button_1.Button>
                          </dialog_1.DialogTrigger>
                          <dialog_1.DialogContent className="max-w-3xl">
                            <dialog_1.DialogHeader>
                              <dialog_1.DialogTitle>Table {table.number} Service Details</dialog_1.DialogTitle>
                            </dialog_1.DialogHeader>

                            {selectedTable && (<tabs_1.Tabs defaultValue="timeline" className="w-full">
                                <tabs_1.TabsList className="grid w-full grid-cols-3">
                                  <tabs_1.TabsTrigger value="timeline">Service Timeline</tabs_1.TabsTrigger>
                                  <tabs_1.TabsTrigger value="orders">Orders</tabs_1.TabsTrigger>
                                  <tabs_1.TabsTrigger value="actions">Service Actions</tabs_1.TabsTrigger>
                                </tabs_1.TabsList>

                                <tabs_1.TabsContent value="timeline" className="space-y-4 py-4">
                                  <div className="relative pl-6 pb-10">
                                    <div className="absolute left-0 top-0 bottom-0 w-px bg-border"></div>

                                    {/* Seated */}
                                    <div className="relative mb-8">
                                      <div className="absolute -left-2 top-1 h-4 w-4 rounded-full bg-primary"></div>
                                      <div className="font-medium">Customer Seated</div>
                                      <div className="text-sm text-muted-foreground">
                                        {table.startTime ? (0, date_fns_1.format)(new Date(table.startTime), "h:mm a") : "N/A"}
                                      </div>
                                    </div>

                                    {/* Orders */}
                                    {table.orders.map((order, index) => (<div key={order.id} className="relative mb-8">
                                        <div className="absolute -left-2 top-1 h-4 w-4 rounded-full bg-primary"></div>
                                        <div className="font-medium">Order #{index + 1} Placed</div>
                                        <div className="text-sm text-muted-foreground">
                                          {(0, date_fns_1.format)(new Date(order.createdAt), "h:mm a")}
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                          <badge_1.Badge variant="outline" className={getOrderStatusColor(order.status)}>
                                            {order.status}
                                          </badge_1.Badge>
                                          <span className="text-sm text-muted-foreground">
                                            {order.items.length} items
                                          </span>
                                        </div>
                                      </div>))}

                                    {/* Current time */}
                                    <div className="relative">
                                      <div className="absolute -left-2 top-1 h-4 w-4 rounded-full bg-muted"></div>
                                      <div className="font-medium">Current Time</div>
                                      <div className="text-sm text-muted-foreground">
                                        {(0, date_fns_1.format)(currentTime, "h:mm a")}
                                      </div>
                                    </div>
                                  </div>
                                </tabs_1.TabsContent>

                                <tabs_1.TabsContent value="orders" className="space-y-4 py-4">
                                  {table.orders.length === 0 ? (<div className="text-center text-muted-foreground py-8">No orders placed yet</div>) : (<div className="space-y-4">
                                      {table.orders.map((order, index) => (<card_1.Card key={order.id}>
                                          <card_1.CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-2">
                                              <h4 className="font-medium">Order #{index + 1}</h4>
                                              <badge_1.Badge variant="outline" className={getOrderStatusColor(order.status)}>
                                                {order.status}
                                              </badge_1.Badge>
                                            </div>

                                            <div className="text-sm text-muted-foreground mb-4">
                                              Placed at {(0, date_fns_1.format)(new Date(order.createdAt), "h:mm a")}
                                            </div>

                                            <div className="space-y-2">
                                              {order.items.map((item, itemIndex) => (<div key={itemIndex} className="flex justify-between">
                                                  <div>
                                                    <span>{item.quantity}x </span>
                                                    <span className="font-medium">{item.title}</span>
                                                    {item.specialInstructions && (<div className="text-xs text-muted-foreground">
                                                        Note: {item.specialInstructions}
                                                      </div>)}
                                                  </div>
                                                  <div>${(item.totalPrice / 100).toFixed(2)}</div>
                                                </div>))}
                                            </div>

                                            <div className="mt-4 pt-4 border-t flex justify-between font-medium">
                                              <span>Total</span>
                                              <span>${(order.total / 100).toFixed(2)}</span>
                                            </div>
                                          </card_1.CardContent>
                                        </card_1.Card>))}
                                    </div>)}
                                </tabs_1.TabsContent>

                                <tabs_1.TabsContent value="actions" className="space-y-4 py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <button_1.Button className="w-full">Request Server Assistance</button_1.Button>
                                    <button_1.Button className="w-full">Mark Course Delivered</button_1.Button>
                                    <button_1.Button className="w-full">Add Service Note</button_1.Button>
                                    <button_1.Button className="w-full">Request Check</button_1.Button>
                                    <button_1.Button className="w-full" variant="destructive">
                                      Mark Table as Problem
                                    </button_1.Button>
                                    <button_1.Button className="w-full" variant="outline">
                                      Print Service Timeline
                                    </button_1.Button>
                                  </div>
                                </tabs_1.TabsContent>
                              </tabs_1.Tabs>)}
                          </dialog_1.DialogContent>
                        </dialog_1.Dialog>
                      </div>
                    </div>
                  </card_1.CardContent>
                </card_1.Card>);
            })}
          </div>)}
      </scroll_area_1.ScrollArea>
    </div>);
}
