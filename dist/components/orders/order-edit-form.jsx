"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderEditForm = OrderEditForm;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const OrderContext_1 = require("@/context/OrderContext");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const label_1 = require("@/components/ui/label");
const textarea_1 = require("@/components/ui/textarea");
const use_toast_1 = require("@/components/ui/use-toast");
const lucide_react_1 = require("lucide-react");
function OrderEditForm({ order, onCancel }) {
    const router = (0, navigation_1.useRouter)();
    const { updateOrderItems } = (0, OrderContext_1.useOrder)();
    const [items, setItems] = (0, react_1.useState)(order.items);
    const [notes, setNotes] = (0, react_1.useState)(order.notes || "");
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (items.length === 0) {
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Order must contain at least one item",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);
        try {
            await updateOrderItems(order.id, items);
            (0, use_toast_1.toast)({
                title: "Success",
                description: "Order updated successfully",
            });
            onCancel();
        }
        catch (error) {
            console.error("Error updating order:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to update order",
                variant: "destructive",
            });
        }
        finally {
            setIsSubmitting(false);
        }
    };
    // This is a simplified version - in a real app, you'd need more complex item editing
    const handleRemoveItem = (itemId) => {
        setItems(items.filter((item) => item.id !== itemId));
    };
    const handleUpdateQuantity = (itemId, newQuantity) => {
        if (newQuantity <= 0) {
            handleRemoveItem(itemId);
            return;
        }
        setItems(items.map((item) => {
            if (item.id === itemId) {
                const unitPrice = item.price;
                return Object.assign(Object.assign({}, item), { quantity: newQuantity, totalPrice: unitPrice * newQuantity });
            }
            return item;
        }));
    };
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = 0.05; // 5% tax rate
    const tax = subtotal * taxRate;
    const total = subtotal + tax - (order.discount || 0);
    return (<form onSubmit={handleSubmit} className="space-y-6">
      <card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle>Edit Order #{order.id.substring(0, 8)}</card_1.CardTitle>
        </card_1.CardHeader>
        <card_1.CardContent className="space-y-4">
          <div className="space-y-2">
            <label_1.Label htmlFor="notes">Order Notes</label_1.Label>
            <textarea_1.Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter any special instructions or notes" rows={3}/>
          </div>

          <div className="space-y-2">
            <label_1.Label>Order Items</label_1.Label>
            <div className="space-y-3">
              {items.map((item) => (<div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex flex-1 items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${item.image})` }}/>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium">{item.title}</h4>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          ${item.price.toFixed(2)} × {item.quantity}
                        </span>
                        <span className="font-medium">${item.totalPrice.toFixed(2)}</span>
                      </div>
                      {item.specialInstructions && (<p className="mt-1 text-xs text-muted-foreground">Note: {item.specialInstructions}</p>)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button_1.Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}>
                      -
                    </button_1.Button>
                    <span className="w-5 text-center">{item.quantity}</span>
                    <button_1.Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}>
                      +
                    </button_1.Button>
                    <button_1.Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleRemoveItem(item.id)}>
                      <lucide_react_1.Trash2 className="h-4 w-4"/>
                    </button_1.Button>
                  </div>
                </div>))}
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax ({(taxRate * 100).toFixed(0)}%):</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            {order.discount > 0 && (<div className="flex justify-between text-red-500">
                <span>Discount:</span>
                <span>-${order.discount.toFixed(2)}</span>
              </div>)}
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </card_1.CardContent>
        <card_1.CardFooter className="flex justify-between">
          <button_1.Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </button_1.Button>
          <button_1.Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (<>
                <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                Updating...
              </>) : ("Update Order")}
          </button_1.Button>
        </card_1.CardFooter>
      </card_1.Card>
    </form>);
}
