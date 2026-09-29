"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = FeedbackPage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const textarea_1 = require("@/components/ui/textarea");
const radio_group_1 = require("@/components/ui/radio-group");
const label_1 = require("@/components/ui/label");
const use_toast_1 = require("@/components/ui/use-toast");
const customer_header_1 = require("@/components/customer/customer-header");
const customer_footer_1 = require("@/components/customer/customer-footer");
const lucide_react_1 = require("lucide-react");
function FeedbackPage() {
    const searchParams = (0, navigation_1.useSearchParams)();
    const router = (0, navigation_1.useRouter)();
    const orderId = searchParams.get("orderId");
    const tableNumber = searchParams.get("table");
    const [order, setOrder] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [submitting, setSubmitting] = (0, react_1.useState)(false);
    const [rating, setRating] = (0, react_1.useState)(null);
    const [foodQuality, setFoodQuality] = (0, react_1.useState)(null);
    const [serviceQuality, setServiceQuality] = (0, react_1.useState)(null);
    const [ambience, setAmbience] = (0, react_1.useState)(null);
    const [comments, setComments] = (0, react_1.useState)("");
    (0, react_1.useEffect)(() => {
        const fetchOrder = async () => {
            if (orderId) {
                try {
                    const response = await fetch(`/api/customer/orders/${orderId}`);
                    if (!response.ok) {
                        throw new Error("Failed to fetch order");
                    }
                    const data = await response.json();
                    setOrder(data);
                }
                catch (error) {
                    console.error("Error fetching order:", error);
                    (0, use_toast_1.toast)({
                        title: "Error",
                        description: "Failed to load order details",
                        variant: "destructive",
                    });
                }
                finally {
                    setLoading(false);
                }
            }
            else {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [orderId]);
    const handleSubmit = async () => {
        if (!rating) {
            (0, use_toast_1.toast)({
                title: "Rating required",
                description: "Please provide an overall rating",
                variant: "destructive",
            });
            return;
        }
        setSubmitting(true);
        try {
            const feedbackData = {
                orderId: orderId || null,
                tableNumber: tableNumber || null,
                rating,
                foodQuality,
                serviceQuality,
                ambience,
                comments,
                timestamp: new Date().toISOString(),
            };
            const response = await fetch("/api/customer/feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(feedbackData),
            });
            if (!response.ok) {
                throw new Error("Failed to submit feedback");
            }
            (0, use_toast_1.toast)({
                title: "Thank you!",
                description: "Your feedback has been submitted successfully",
            });
            // Redirect to thank you page
            router.push(`/customer/feedback/thank-you${tableNumber ? `?table=${tableNumber}` : ""}`);
        }
        catch (error) {
            console.error("Error submitting feedback:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to submit feedback. Please try again.",
                variant: "destructive",
            });
        }
        finally {
            setSubmitting(false);
        }
    };
    const StarRating = ({ value, onChange }) => {
        return (<div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (<button key={star} type="button" onClick={() => onChange(star)} className="focus:outline-none">
            <lucide_react_1.Star className={`h-8 w-8 ${value && star <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}/>
          </button>))}
      </div>);
    };
    if (loading) {
        return (<div className="flex flex-col min-h-screen">
        <customer_header_1.CustomerHeader tableNumber={tableNumber} showBackButton title="Feedback"/>

        <main className="flex-1 container max-w-lg mx-auto px-4 py-6 flex items-center justify-center">
          <div className="text-center">
            <lucide_react_1.Loader2 className="h-8 w-8 animate-spin mx-auto mb-4"/>
            <p>Loading...</p>
          </div>
        </main>

        <customer_footer_1.CustomerFooter />
      </div>);
    }
    return (<div className="flex flex-col min-h-screen">
      <customer_header_1.CustomerHeader tableNumber={tableNumber} showBackButton title="Feedback"/>

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Share Your Feedback</card_1.CardTitle>
            <card_1.CardDescription>
              {order ? `For your order #${order.id.slice(0, 8)}` : "Help us improve your experience"}
            </card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent className="space-y-6">
            <div className="space-y-2">
              <label_1.Label>Overall Rating</label_1.Label>
              <StarRating value={rating} onChange={setRating}/>
            </div>

            <div className="space-y-4">
              <label_1.Label>Food Quality</label_1.Label>
              <radio_group_1.RadioGroup value={(foodQuality === null || foodQuality === void 0 ? void 0 : foodQuality.toString()) || ""} onValueChange={(value) => setFoodQuality(Number.parseInt(value))} className="flex">
                {[1, 2, 3, 4, 5].map((value) => (<div key={value} className="flex flex-col items-center space-y-1 flex-1">
                    <radio_group_1.RadioGroupItem value={value.toString()} id={`food-${value}`} className="sr-only"/>
                    <label_1.Label htmlFor={`food-${value}`} className={`cursor-pointer rounded-full p-2 ${foodQuality === value ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {value}
                    </label_1.Label>
                    {value === 1 && <span className="text-xs">Poor</span>}
                    {value === 5 && <span className="text-xs">Excellent</span>}
                  </div>))}
              </radio_group_1.RadioGroup>
            </div>

            <div className="space-y-4">
              <label_1.Label>Service Quality</label_1.Label>
              <radio_group_1.RadioGroup value={(serviceQuality === null || serviceQuality === void 0 ? void 0 : serviceQuality.toString()) || ""} onValueChange={(value) => setServiceQuality(Number.parseInt(value))} className="flex">
                {[1, 2, 3, 4, 5].map((value) => (<div key={value} className="flex flex-col items-center space-y-1 flex-1">
                    <radio_group_1.RadioGroupItem value={value.toString()} id={`service-${value}`} className="sr-only"/>
                    <label_1.Label htmlFor={`service-${value}`} className={`cursor-pointer rounded-full p-2 ${serviceQuality === value ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {value}
                    </label_1.Label>
                    {value === 1 && <span className="text-xs">Poor</span>}
                    {value === 5 && <span className="text-xs">Excellent</span>}
                  </div>))}
              </radio_group_1.RadioGroup>
            </div>

            <div className="space-y-4">
              <label_1.Label>Ambience</label_1.Label>
              <radio_group_1.RadioGroup value={(ambience === null || ambience === void 0 ? void 0 : ambience.toString()) || ""} onValueChange={(value) => setAmbience(Number.parseInt(value))} className="flex">
                {[1, 2, 3, 4, 5].map((value) => (<div key={value} className="flex flex-col items-center space-y-1 flex-1">
                    <radio_group_1.RadioGroupItem value={value.toString()} id={`ambience-${value}`} className="sr-only"/>
                    <label_1.Label htmlFor={`ambience-${value}`} className={`cursor-pointer rounded-full p-2 ${ambience === value ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {value}
                    </label_1.Label>
                    {value === 1 && <span className="text-xs">Poor</span>}
                    {value === 5 && <span className="text-xs">Excellent</span>}
                  </div>))}
              </radio_group_1.RadioGroup>
            </div>

            <div className="space-y-2">
              <label_1.Label htmlFor="comments">Additional Comments</label_1.Label>
              <textarea_1.Textarea id="comments" placeholder="Tell us more about your experience..." value={comments} onChange={(e) => setComments(e.target.value)} className="resize-none" rows={4}/>
            </div>
          </card_1.CardContent>
          <card_1.CardFooter>
            <button_1.Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? (<>
                  <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  Submitting...
                </>) : ("Submit Feedback")}
            </button_1.Button>
          </card_1.CardFooter>
        </card_1.Card>
      </main>

      <customer_footer_1.CustomerFooter />
    </div>);
}
