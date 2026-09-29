"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateOrderForm = CreateOrderForm;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const CartContext_1 = require("@/context/CartContext");
const OrderContext_1 = require("@/context/OrderContext");
const AuthContext_1 = require("@/context/AuthContext");
const TableContext_1 = require("@/context/TableContext");
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const textarea_1 = require("@/components/ui/textarea");
const radio_group_1 = require("@/components/ui/radio-group");
const use_toast_1 = require("@/components/ui/use-toast");
const lucide_react_1 = require("lucide-react");
const order_item_list_1 = require("./order-item-list");
const item_customization_modal_1 = require("./item-customization-modal");
function CreateOrderForm() {
    const router = (0, navigation_1.useRouter)();
    const { state: cartState, clearCart } = (0, CartContext_1.useCart)();
    const { createOrder } = (0, OrderContext_1.useOrder)();
    const { state: authState } = (0, AuthContext_1.useAuth)();
    const { state: tableState } = (0, TableContext_1.useTable)();
    const [customerName, setCustomerName] = (0, react_1.useState)("");
    const [notes, setNotes] = (0, react_1.useState)("");
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const [selectedItem, setSelectedItem] = (0, react_1.useState)(null);
    const [isCustomizationModalOpen, setIsCustomizationModalOpen] = (0, react_1.useState)(false);
    const handleSubmit = async (e) => {
        var _a;
        e.preventDefault();
        if (cartState.items.length === 0) {
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Please add items to the order",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);
        try {
            const order = await createOrder(cartState.items, cartState.tableId, customerName || cartState.customerName, cartState.diningMode, ((_a = authState.user) === null || _a === void 0 ? void 0 : _a.id) || "", cartState.subtotal, cartState.tax, cartState.discount, cartState.total, notes);
            clearCart();
            (0, use_toast_1.toast)({
                title: "Success",
                description: "Order created successfully",
            });
            // Redirect to the order details page
            router.push(`/dashboard/orders/${order.id}`);
        }
        catch (error) {
            console.error("Error creating order:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to create order",
                variant: "destructive",
            });
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleItemClick = (item) => {
        setSelectedItem(item);
        setIsCustomizationModalOpen(true);
    };
    return (<>
      <form onSubmit={handleSubmit} className="space-y-6">
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Create New Order</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent className="space-y-4">
            <div className="space-y-2">
              <label_1.Label htmlFor="diningMode">Dining Mode</label_1.Label>
              <radio_group_1.RadioGroup defaultValue={cartState.diningMode} className="flex space-x-4" onValueChange={(value) => {
            // This would call setDiningMode from the cart context
        }}>
                <div className="flex items-center space-x-2">
                  <radio_group_1.RadioGroupItem value="Dine in" id="dineIn"/>
                  <label_1.Label htmlFor="dineIn">Dine In</label_1.Label>
                </div>
                <div className="flex items-center space-x-2">
                  <radio_group_1.RadioGroupItem value="Take Away" id="takeAway"/>
                  <label_1.Label htmlFor="takeAway">Take Away</label_1.Label>
                </div>
                <div className="flex items-center space-x-2">
                  <radio_group_1.RadioGroupItem value="Delivery" id="delivery"/>
                  <label_1.Label htmlFor="delivery">Delivery</label_1.Label>
                </div>
              </radio_group_1.RadioGroup>
            </div>

            {cartState.diningMode === "Dine in" && (<div className="space-y-2">
                <label_1.Label htmlFor="table">Table</label_1.Label>
                <select id="table" className="w-full rounded-md border border-input bg-background px-3 py-2" value={cartState.tableId || ""} onChange={(e) => {
                // This would call setTable from the cart context
            }}>
                  <option value="">Select a table</option>
                  {tableState.tables
                .filter((table) => table.status === "available")
                .map((table) => (<option key={table.id} value={table.id}>
                        Table {table.number} (Capacity: {table.capacity})
                      </option>))}
                </select>
              </div>)}

            <div className="space-y-2">
              <label_1.Label htmlFor="customerName">Customer Name</label_1.Label>
              <input_1.Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter customer name"/>
            </div>

            <div className="space-y-2">
              <label_1.Label htmlFor="notes">Order Notes</label_1.Label>
              <textarea_1.Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter any special instructions or notes" rows={3}/>
            </div>

            <div className="space-y-2">
              <label_1.Label>Order Items</label_1.Label>
              <order_item_list_1.OrderItemList items={cartState.items} onItemClick={handleItemClick}/>
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${cartState.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax ({((cartState.tax / cartState.subtotal) * 100).toFixed(0)}%):</span>
                <span>${cartState.tax.toFixed(2)}</span>
              </div>
              {cartState.discount > 0 && (<div className="flex justify-between text-red-500">
                  <span>Discount:</span>
                  <span>-${cartState.discount.toFixed(2)}</span>
                </div>)}
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span>${cartState.total.toFixed(2)}</span>
              </div>
            </div>
          </card_1.CardContent>
          <card_1.CardFooter>
            <button_1.Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (<>
                  <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  Processing...
                </>) : ("Create Order")}
            </button_1.Button>
          </card_1.CardFooter>
        </card_1.Card>
      </form>

      {selectedItem && (<item_customization_modal_1.ItemCustomizationModal item={selectedItem} isOpen={isCustomizationModalOpen} onClose={() => setIsCustomizationModalOpen(false)}/>)}
    </>);
}
