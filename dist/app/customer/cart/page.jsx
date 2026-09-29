"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CustomerCartPage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const radio_group_1 = require("@/components/ui/radio-group");
const separator_1 = require("@/components/ui/separator");
const textarea_1 = require("@/components/ui/textarea");
const use_toast_1 = require("@/components/ui/use-toast");
const customer_header_1 = require("@/components/customer/customer-header");
const customer_footer_1 = require("@/components/customer/customer-footer");
const customer_cart_item_1 = require("@/components/customer/customer-cart-item");
const lucide_react_1 = require("lucide-react");
const link_1 = __importDefault(require("next/link"));
function CustomerCartPage() {
    const searchParams = (0, navigation_1.useSearchParams)();
    const router = (0, navigation_1.useRouter)();
    const tableNumber = searchParams.get("table");
    const [cart, setCart] = (0, react_1.useState)({
        items: [],
        tableNumber: tableNumber || undefined,
        diningMode: "Dine in",
        subtotal: 0,
        tax: 0,
        total: 0,
    });
    const [customerName, setCustomerName] = (0, react_1.useState)("");
    const [notes, setNotes] = (0, react_1.useState)("");
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        // Load cart from localStorage
        const storedCart = localStorage.getItem("customerCart");
        if (storedCart) {
            try {
                const parsedCart = JSON.parse(storedCart);
                setCart(parsedCart);
                if (parsedCart.customerName) {
                    setCustomerName(parsedCart.customerName);
                }
                if (parsedCart.notes) {
                    setNotes(parsedCart.notes);
                }
            }
            catch (error) {
                console.error("Error parsing cart from localStorage", error);
            }
        }
    }, []);
    const updateCart = (updatedCart) => {
        setCart(updatedCart);
        localStorage.setItem("customerCart", JSON.stringify(updatedCart));
    };
    const handleRemoveItem = (itemId) => {
        const updatedItems = cart.items.filter((item) => item.id !== itemId);
        // Recalculate totals
        const subtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const tax = subtotal * 0.05; // 5% tax
        const total = subtotal + tax;
        const updatedCart = Object.assign(Object.assign({}, cart), { items: updatedItems, subtotal,
            tax,
            total });
        updateCart(updatedCart);
        (0, use_toast_1.toast)({
            title: "Item removed",
            description: "The item has been removed from your cart",
        });
    };
    const handleUpdateQuantity = (itemId, newQuantity) => {
        if (newQuantity <= 0) {
            handleRemoveItem(itemId);
            return;
        }
        const updatedItems = cart.items.map((item) => {
            if (item.id === itemId) {
                const unitPrice = item.totalPrice / item.quantity;
                return Object.assign(Object.assign({}, item), { quantity: newQuantity, totalPrice: unitPrice * newQuantity });
            }
            return item;
        });
        // Recalculate totals
        const subtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const tax = subtotal * 0.05; // 5% tax
        const total = subtotal + tax;
        const updatedCart = Object.assign(Object.assign({}, cart), { items: updatedItems, subtotal,
            tax,
            total });
        updateCart(updatedCart);
    };
    const handleDiningModeChange = (value) => {
        updateCart(Object.assign(Object.assign({}, cart), { diningMode: value }));
    };
    const handleClearCart = () => {
        updateCart({
            items: [],
            tableNumber: cart.tableNumber,
            diningMode: cart.diningMode,
            subtotal: 0,
            tax: 0,
            total: 0,
        });
        setNotes("");
        (0, use_toast_1.toast)({
            title: "Cart cleared",
            description: "All items have been removed from your cart",
        });
    };
    const handleSubmitOrder = async () => {
        if (cart.items.length === 0) {
            (0, use_toast_1.toast)({
                title: "Empty cart",
                description: "Please add items to your cart before placing an order",
                variant: "destructive",
            });
            return;
        }
        if (!cart.tableNumber && cart.diningMode === "Dine in") {
            (0, use_toast_1.toast)({
                title: "Table number required",
                description: "Please provide a table number for dine-in orders",
                variant: "destructive",
            });
            return;
        }
        if (!customerName) {
            (0, use_toast_1.toast)({
                title: "Name required",
                description: "Please provide your name for the order",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);
        try {
            // Prepare order data
            const orderData = {
                items: cart.items,
                tableId: cart.tableNumber,
                customerName,
                diningMode: cart.diningMode,
                subtotal: cart.subtotal,
                tax: cart.tax,
                total: cart.total,
                notes: notes || undefined,
                status: "pending",
            };
            // Submit order to API
            const response = await fetch("/api/customer/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(orderData),
            });
            if (!response.ok) {
                throw new Error("Failed to place order");
            }
            const data = await response.json();
            // Clear cart
            localStorage.removeItem("customerCart");
            // Store order ID for tracking
            localStorage.setItem("lastOrderId", data.id);
            (0, use_toast_1.toast)({
                title: "Order placed successfully",
                description: "Your order has been received and is being processed",
            });
            // Redirect to order tracking page
            router.push(`/customer/order-tracking?orderId=${data.id}${cart.tableNumber ? `&table=${cart.tableNumber}` : ""}`);
        }
        catch (error) {
            console.error("Error submitting order:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to place your order. Please try again.",
                variant: "destructive",
            });
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<div className="flex flex-col min-h-screen">
      <customer_header_1.CustomerHeader tableNumber={tableNumber} showBackButton title="Your Cart"/>

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <div className="space-y-6">
          {cart.items.length > 0 ? (<>
              <div className="space-y-4">
                {cart.items.map((item) => (<customer_cart_item_1.CustomerCartItem key={item.id} item={item} onRemove={() => handleRemoveItem(item.id)} onUpdateQuantity={(quantity) => handleUpdateQuantity(item.id, quantity)}/>))}
              </div>

              <card_1.Card>
                <card_1.CardHeader>
                  <card_1.CardTitle>Order Details</card_1.CardTitle>
                </card_1.CardHeader>
                <card_1.CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label_1.Label htmlFor="customer-name">Your Name</label_1.Label>
                    <input_1.Input id="customer-name" placeholder="Enter your name" value={customerName} onChange={(e) => setCustomerName(e.target.value)}/>
                  </div>

                  <div className="space-y-2">
                    <label_1.Label>Dining Option</label_1.Label>
                    <radio_group_1.RadioGroup value={cart.diningMode} onValueChange={handleDiningModeChange}>
                      <div className="flex items-center space-x-2">
                        <radio_group_1.RadioGroupItem value="Dine in" id="dine-in"/>
                        <label_1.Label htmlFor="dine-in">Dine in</label_1.Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <radio_group_1.RadioGroupItem value="Take Away" id="take-away"/>
                        <label_1.Label htmlFor="take-away">Take Away</label_1.Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <radio_group_1.RadioGroupItem value="Delivery" id="delivery"/>
                        <label_1.Label htmlFor="delivery">Delivery</label_1.Label>
                      </div>
                    </radio_group_1.RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <label_1.Label htmlFor="order-notes">Special Instructions (Optional)</label_1.Label>
                    <textarea_1.Textarea id="order-notes" placeholder="Any special requests for your order?" value={notes} onChange={(e) => setNotes(e.target.value)} className="resize-none"/>
                  </div>
                </card_1.CardContent>
              </card_1.Card>

              <card_1.Card>
                <card_1.CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>${cart.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax (5%)</span>
                      <span>${cart.tax.toFixed(2)}</span>
                    </div>
                    <separator_1.Separator className="my-2"/>
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>${cart.total.toFixed(2)}</span>
                    </div>
                  </div>
                </card_1.CardContent>
                <card_1.CardFooter className="flex justify-between">
                  <button_1.Button variant="outline" onClick={handleClearCart}>
                    <lucide_react_1.Trash2 className="mr-2 h-4 w-4"/>
                    Clear Cart
                  </button_1.Button>
                  <button_1.Button onClick={handleSubmitOrder} disabled={isSubmitting}>
                    {isSubmitting ? (<>
                        <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                        Processing...
                      </>) : ("Place Order")}
                  </button_1.Button>
                </card_1.CardFooter>
              </card_1.Card>
            </>) : (<card_1.Card>
              <card_1.CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <lucide_react_1.ShoppingCart className="h-6 w-6 text-muted-foreground"/>
                </div>
                <h3 className="text-lg font-medium mb-2">Your cart is empty</h3>
                <p className="text-muted-foreground text-center mb-6">
                  Add items from the menu to get started with your order
                </p>
                <button_1.Button asChild>
                  <link_1.default href={`/customer/menu${tableNumber ? `?table=${tableNumber}` : ""}`}>Browse Menu</link_1.default>
                </button_1.Button>
              </card_1.CardContent>
            </card_1.Card>)}
        </div>
      </main>

      <customer_footer_1.CustomerFooter />
    </div>);
}
