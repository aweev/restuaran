"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KitchenCompletedOrders = KitchenCompletedOrders;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const input_1 = require("@/components/ui/input");
const button_1 = require("@/components/ui/button");
const badge_1 = require("@/components/ui/badge");
const table_1 = require("@/components/ui/table");
const dropdown_menu_1 = require("@/components/ui/dropdown-menu");
const date_fns_1 = require("date-fns");
const lucide_react_1 = require("lucide-react");
const kitchen_order_details_1 = require("@/components/kitchen/kitchen-order-details");
function KitchenCompletedOrders({ orders }) {
    const [searchQuery, setSearchQuery] = (0, react_1.useState)("");
    const [selectedOrder, setSelectedOrder] = (0, react_1.useState)(null);
    // Filter orders based on search query
    const filteredOrders = orders.filter((order) => {
        const searchLower = searchQuery.toLowerCase();
        return (order.id.toLowerCase().includes(searchLower) ||
            (order.customerName && order.customerName.toLowerCase().includes(searchLower)) ||
            (order.tableId && order.tableId.toLowerCase().includes(searchLower)));
    });
    // Calculate preparation time for an order (time between pending and ready)
    const calculatePrepTime = (order) => {
        // This is a simplified calculation - in a real system you would track status change timestamps
        const createdTime = new Date(order.createdAt).getTime();
        const updatedTime = new Date(order.updatedAt).getTime();
        const diffMinutes = Math.round((updatedTime - createdTime) / 60000);
        return `${diffMinutes} min`;
    };
    const handleViewOrder = (order) => {
        setSelectedOrder(order);
    };
    const handleCloseDetails = () => {
        setSelectedOrder(null);
    };
    return (<card_1.Card>
      <card_1.CardHeader className="pb-2">
        <card_1.CardTitle className="text-xl">Completed Orders</card_1.CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <lucide_react_1.Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/>
            <input_1.Input placeholder="Search orders..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
          </div>
        </div>
      </card_1.CardHeader>
      <card_1.CardContent>
        <div className="rounded-md border">
          <table_1.Table>
            <table_1.TableHeader>
              <table_1.TableRow>
                <table_1.TableHead>Order ID</table_1.TableHead>
                <table_1.TableHead>Customer/Table</table_1.TableHead>
                <table_1.TableHead>Status</table_1.TableHead>
                <table_1.TableHead>Completed At</table_1.TableHead>
                <table_1.TableHead>Prep Time</table_1.TableHead>
                <table_1.TableHead>Items</table_1.TableHead>
                <table_1.TableHead className="text-right">Actions</table_1.TableHead>
              </table_1.TableRow>
            </table_1.TableHeader>
            <table_1.TableBody>
              {filteredOrders.length === 0 ? (<table_1.TableRow>
                  <table_1.TableCell colSpan={7} className="h-24 text-center">
                    No completed orders found
                  </table_1.TableCell>
                </table_1.TableRow>) : (filteredOrders.map((order) => (<table_1.TableRow key={order.id}>
                    <table_1.TableCell className="font-mono text-xs">{order.id.substring(0, 8)}</table_1.TableCell>
                    <table_1.TableCell>{order.tableId ? `Table ${order.tableId}` : order.customerName || "Takeaway"}</table_1.TableCell>
                    <table_1.TableCell>
                      <badge_1.Badge variant="outline" className={order.status === "completed"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"}>
                        {order.status}
                      </badge_1.Badge>
                    </table_1.TableCell>
                    <table_1.TableCell>{(0, date_fns_1.format)(new Date(order.updatedAt), "MMM d, h:mm a")}</table_1.TableCell>
                    <table_1.TableCell className="flex items-center gap-1">
                      <lucide_react_1.Clock className="h-3 w-3 text-muted-foreground"/>
                      {calculatePrepTime(order)}
                    </table_1.TableCell>
                    <table_1.TableCell>{order.items.length}</table_1.TableCell>
                    <table_1.TableCell className="text-right">
                      <dropdown_menu_1.DropdownMenu>
                        <dropdown_menu_1.DropdownMenuTrigger asChild>
                          <button_1.Button variant="ghost" size="icon">
                            <lucide_react_1.MoreVertical className="h-4 w-4"/>
                          </button_1.Button>
                        </dropdown_menu_1.DropdownMenuTrigger>
                        <dropdown_menu_1.DropdownMenuContent align="end">
                          <dropdown_menu_1.DropdownMenuItem onClick={() => handleViewOrder(order)}>
                            <lucide_react_1.Eye className="mr-2 h-4 w-4"/>
                            View Details
                          </dropdown_menu_1.DropdownMenuItem>
                          <dropdown_menu_1.DropdownMenuItem>
                            <lucide_react_1.FileText className="mr-2 h-4 w-4"/>
                            Print Ticket
                          </dropdown_menu_1.DropdownMenuItem>
                        </dropdown_menu_1.DropdownMenuContent>
                      </dropdown_menu_1.DropdownMenu>
                    </table_1.TableCell>
                  </table_1.TableRow>)))}
            </table_1.TableBody>
          </table_1.Table>
        </div>
      </card_1.CardContent>

      {selectedOrder && (<kitchen_order_details_1.KitchenOrderDetails order={selectedOrder} onClose={handleCloseDetails} prepTime={10} // Default value since it's already completed
        />)}
    </card_1.Card>);
}
