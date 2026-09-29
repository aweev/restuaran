"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryIntegration = DeliveryIntegration;
const react_1 = require("react");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const radio_group_1 = require("@/components/ui/radio-group");
const textarea_1 = require("@/components/ui/textarea");
const use_toast_1 = require("@/components/ui/use-toast");
const dialog_1 = require("@/components/ui/dialog");
const lucide_react_1 = require("lucide-react");
function DeliveryIntegration({ order }) {
    const [isDialogOpen, setIsDialogOpen] = (0, react_1.useState)(false);
    const [selectedProvider, setSelectedProvider] = (0, react_1.useState)("restaurant");
    const [address, setAddress] = (0, react_1.useState)({
        street: "",
        city: "",
        state: "",
        zipCode: "",
    });
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const handleAddressChange = (field, value) => {
        setAddress((prev) => (Object.assign(Object.assign({}, prev), { [field]: value })));
    };
    const handleSubmit = async () => {
        // Validate address
        if (!address.street || !address.city || !address.state || !address.zipCode) {
            (0, use_toast_1.toast)({
                title: "Missing information",
                description: "Please fill in all address fields",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);
        try {
            const response = await fetch(`/api/customer/orders/${order.id}/delivery`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    provider: selectedProvider,
                    address,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to set up delivery");
            }
            const data = await response.json();
            (0, use_toast_1.toast)({
                title: "Delivery set up successfully",
                description: selectedProvider === "restaurant"
                    ? "Your order will be delivered by our restaurant"
                    : `Your order has been sent to ${selectedProvider}`,
            });
            setIsDialogOpen(false);
            // If external provider, redirect to their site
            if (selectedProvider !== "restaurant" && data.redirectUrl) {
                window.open(data.redirectUrl, "_blank");
            }
        }
        catch (error) {
            console.error("Error setting up delivery:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to set up delivery. Please try again.",
                variant: "destructive",
            });
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<dialog_1.Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <dialog_1.DialogTrigger asChild>
        <button_1.Button className="w-full">
          <lucide_react_1.Truck className="mr-2 h-4 w-4"/>
          Set Up Delivery
        </button_1.Button>
      </dialog_1.DialogTrigger>
      <dialog_1.DialogContent className="sm:max-w-md">
        <dialog_1.DialogHeader>
          <dialog_1.DialogTitle>Delivery Options</dialog_1.DialogTitle>
          <dialog_1.DialogDescription>Choose a delivery provider and enter your address</dialog_1.DialogDescription>
        </dialog_1.DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label_1.Label>Delivery Provider</label_1.Label>
            <radio_group_1.RadioGroup value={selectedProvider} onValueChange={(value) => setSelectedProvider(value)} className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center gap-2 rounded-md border p-4 hover:bg-muted">
                <radio_group_1.RadioGroupItem value="restaurant" id="restaurant" className="sr-only"/>
                <label_1.Label htmlFor="restaurant" className="cursor-pointer text-center">
                  <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <lucide_react_1.Truck className="h-6 w-6"/>
                  </div>
                  Restaurant Delivery
                </label_1.Label>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-md border p-4 hover:bg-muted">
                <radio_group_1.RadioGroupItem value="doordash" id="doordash" className="sr-only"/>
                <label_1.Label htmlFor="doordash" className="cursor-pointer text-center">
                  <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="font-bold text-red-600">DD</span>
                  </div>
                  DoorDash
                </label_1.Label>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-md border p-4 hover:bg-muted">
                <radio_group_1.RadioGroupItem value="ubereats" id="ubereats" className="sr-only"/>
                <label_1.Label htmlFor="ubereats" className="cursor-pointer text-center">
                  <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-black flex items-center justify-center">
                    <span className="font-bold text-white">UE</span>
                  </div>
                  Uber Eats
                </label_1.Label>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-md border p-4 hover:bg-muted">
                <radio_group_1.RadioGroupItem value="grubhub" id="grubhub" className="sr-only"/>
                <label_1.Label htmlFor="grubhub" className="cursor-pointer text-center">
                  <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                    <span className="font-bold text-orange-600">GH</span>
                  </div>
                  Grubhub
                </label_1.Label>
              </div>
            </radio_group_1.RadioGroup>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium">Delivery Address</h3>

            <div className="space-y-2">
              <label_1.Label htmlFor="street">Street Address</label_1.Label>
              <input_1.Input id="street" value={address.street} onChange={(e) => handleAddressChange("street", e.target.value)} placeholder="123 Main St"/>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label_1.Label htmlFor="city">City</label_1.Label>
                <input_1.Input id="city" value={address.city} onChange={(e) => handleAddressChange("city", e.target.value)} placeholder="New York"/>
              </div>
              <div className="space-y-2">
                <label_1.Label htmlFor="state">State</label_1.Label>
                <input_1.Input id="state" value={address.state} onChange={(e) => handleAddressChange("state", e.target.value)} placeholder="NY"/>
              </div>
            </div>

            <div className="space-y-2">
              <label_1.Label htmlFor="zipCode">ZIP Code</label_1.Label>
              <input_1.Input id="zipCode" value={address.zipCode} onChange={(e) => handleAddressChange("zipCode", e.target.value)} placeholder="10001"/>
            </div>

            <div className="space-y-2">
              <label_1.Label htmlFor="instructions">Delivery Instructions (Optional)</label_1.Label>
              <textarea_1.Textarea id="instructions" value={address.instructions || ""} onChange={(e) => handleAddressChange("instructions", e.target.value)} placeholder="Apartment number, gate code, etc." className="resize-none"/>
            </div>
          </div>
        </div>

        <dialog_1.DialogFooter>
          <button_1.Button variant="outline" onClick={() => setIsDialogOpen(false)}>
            Cancel
          </button_1.Button>
          <button_1.Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (<>
                <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                Processing...
              </>) : ("Confirm Delivery")}
          </button_1.Button>
        </dialog_1.DialogFooter>
      </dialog_1.DialogContent>
    </dialog_1.Dialog>);
}
