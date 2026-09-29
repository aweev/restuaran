"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentForm = PaymentForm;
const react_1 = require("react");
const OrderContext_1 = require("@/context/OrderContext");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const radio_group_1 = require("@/components/ui/radio-group");
const use_toast_1 = require("@/components/ui/use-toast");
const lucide_react_1 = require("lucide-react");
function PaymentForm({ orderId, totalDue, totalPaid }) {
    const { addPayment } = (0, OrderContext_1.useOrder)();
    const [paymentMethod, setPaymentMethod] = (0, react_1.useState)("cash");
    const [amount, setAmount] = (0, react_1.useState)(totalDue - totalPaid);
    const [reference, setReference] = (0, react_1.useState)("");
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const [isSplitPayment, setIsSplitPayment] = (0, react_1.useState)(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (amount <= 0) {
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Payment amount must be greater than zero",
                variant: "destructive",
            });
            return;
        }
        if (amount > totalDue - totalPaid) {
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Payment amount cannot exceed the remaining balance",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);
        try {
            await addPayment(orderId, {
                method: paymentMethod,
                amount,
                reference: reference || undefined,
                timestamp: new Date().toISOString(),
            });
            (0, use_toast_1.toast)({
                title: "Success",
                description: "Payment processed successfully",
            });
            // Reset form if it's a split payment and there's still a balance
            if (isSplitPayment && totalPaid + amount < totalDue) {
                setAmount(totalDue - (totalPaid + amount));
                setReference("");
            }
        }
        catch (error) {
            console.error("Error processing payment:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to process payment",
                variant: "destructive",
            });
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const remainingBalance = totalDue - totalPaid;
    return (<form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label_1.Label htmlFor="amount">Payment Amount</label_1.Label>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="splitPayment" checked={isSplitPayment} onChange={(e) => {
            setIsSplitPayment(e.target.checked);
            if (!e.target.checked) {
                setAmount(remainingBalance);
            }
        }} className="h-4 w-4 rounded border-gray-300"/>
            <label_1.Label htmlFor="splitPayment" className="text-sm">
              Split Payment
            </label_1.Label>
          </div>
        </div>
        <input_1.Input id="amount" type="number" step="0.01" min="0.01" max={remainingBalance} value={amount} onChange={(e) => setAmount(Number.parseFloat(e.target.value))} required/>
      </div>

      <div className="space-y-2">
        <label_1.Label>Payment Method</label_1.Label>
        <radio_group_1.RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value)} className="grid grid-cols-2 gap-2">
          <div className="flex items-center space-x-2">
            <radio_group_1.RadioGroupItem value="cash" id="cash"/>
            <label_1.Label htmlFor="cash">Cash</label_1.Label>
          </div>
          <div className="flex items-center space-x-2">
            <radio_group_1.RadioGroupItem value="credit" id="credit"/>
            <label_1.Label htmlFor="credit">Credit Card</label_1.Label>
          </div>
          <div className="flex items-center space-x-2">
            <radio_group_1.RadioGroupItem value="debit" id="debit"/>
            <label_1.Label htmlFor="debit">Debit Card</label_1.Label>
          </div>
          <div className="flex items-center space-x-2">
            <radio_group_1.RadioGroupItem value="mobile" id="mobile"/>
            <label_1.Label htmlFor="mobile">Mobile Payment</label_1.Label>
          </div>
          <div className="flex items-center space-x-2">
            <radio_group_1.RadioGroupItem value="gift" id="gift"/>
            <label_1.Label htmlFor="gift">Gift Card</label_1.Label>
          </div>
        </radio_group_1.RadioGroup>
      </div>

      <div className="space-y-2">
        <label_1.Label htmlFor="reference">Reference (Optional)</label_1.Label>
        <input_1.Input id="reference" placeholder="Transaction ID, Last 4 digits, etc." value={reference} onChange={(e) => setReference(e.target.value)}/>
      </div>

      <button_1.Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (<>
            <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
            Processing...
          </>) : (`Process ${isSplitPayment ? "Partial" : "Full"} Payment ($${amount.toFixed(2)})`)}
      </button_1.Button>
    </form>);
}
