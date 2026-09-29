"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LoyaltyPage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const use_toast_1 = require("@/components/ui/use-toast");
const customer_header_1 = require("@/components/customer/customer-header");
const customer_footer_1 = require("@/components/customer/customer-footer");
const tabs_1 = require("@/components/ui/tabs");
const badge_1 = require("@/components/ui/badge");
const progress_1 = require("@/components/ui/progress");
const separator_1 = require("@/components/ui/separator");
const lucide_react_1 = require("lucide-react");
function LoyaltyPage() {
    var _a, _b;
    const searchParams = (0, navigation_1.useSearchParams)();
    const tableNumber = searchParams.get("table");
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [customer, setCustomer] = (0, react_1.useState)(null);
    const [rewards, setRewards] = (0, react_1.useState)([]);
    const [email, setEmail] = (0, react_1.useState)("");
    const [phone, setPhone] = (0, react_1.useState)("");
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        // Check if user is already logged in to loyalty program
        const loyaltyId = localStorage.getItem("loyaltyCustomerId");
        if (loyaltyId) {
            fetchCustomerData(loyaltyId);
        }
        else {
            setLoading(false);
        }
        // Fetch available rewards
        fetchRewards();
    }, []);
    const fetchCustomerData = async (customerId) => {
        try {
            const response = await fetch(`/api/customer/loyalty/${customerId}`);
            if (!response.ok) {
                throw new Error("Failed to fetch loyalty customer data");
            }
            const data = await response.json();
            setCustomer(data);
        }
        catch (error) {
            console.error("Error fetching loyalty customer data:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to load loyalty program data",
                variant: "destructive",
            });
            // Clear invalid loyalty ID
            localStorage.removeItem("loyaltyCustomerId");
        }
        finally {
            setLoading(false);
        }
    };
    const fetchRewards = async () => {
        try {
            const response = await fetch("/api/customer/loyalty/rewards");
            if (!response.ok) {
                throw new Error("Failed to fetch rewards");
            }
            const data = await response.json();
            setRewards(data);
        }
        catch (error) {
            console.error("Error fetching rewards:", error);
        }
    };
    const handleLogin = async () => {
        if (!email && !phone) {
            (0, use_toast_1.toast)({
                title: "Input required",
                description: "Please enter your email or phone number",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);
        try {
            const response = await fetch("/api/customer/loyalty/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email || undefined,
                    phone: phone || undefined,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to login to loyalty program");
            }
            const data = await response.json();
            if (data.customer) {
                localStorage.setItem("loyaltyCustomerId", data.customer.id);
                setCustomer(data.customer);
                (0, use_toast_1.toast)({
                    title: "Welcome back!",
                    description: `You have ${data.customer.points} loyalty points available`,
                });
            }
            else {
                (0, use_toast_1.toast)({
                    title: "Account not found",
                    description: "No loyalty account found with these credentials",
                    variant: "destructive",
                });
            }
        }
        catch (error) {
            console.error("Error logging in to loyalty program:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to login to loyalty program",
                variant: "destructive",
            });
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleSignup = async () => {
        if (!email || !phone) {
            (0, use_toast_1.toast)({
                title: "Input required",
                description: "Please enter both email and phone number to sign up",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);
        try {
            const response = await fetch("/api/customer/loyalty/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    phone,
                    tableNumber: tableNumber || undefined,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to sign up for loyalty program");
            }
            const data = await response.json();
            localStorage.setItem("loyaltyCustomerId", data.customer.id);
            setCustomer(data.customer);
            (0, use_toast_1.toast)({
                title: "Welcome to our loyalty program!",
                description: "You've earned 100 welcome points",
            });
        }
        catch (error) {
            console.error("Error signing up for loyalty program:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to sign up for loyalty program",
                variant: "destructive",
            });
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleLogout = () => {
        localStorage.removeItem("loyaltyCustomerId");
        setCustomer(null);
        setEmail("");
        setPhone("");
        (0, use_toast_1.toast)({
            title: "Logged out",
            description: "You've been logged out of the loyalty program",
        });
    };
    const handleRedeemReward = async (rewardId) => {
        if (!customer)
            return;
        try {
            const reward = rewards.find((r) => r.id === rewardId);
            if (!reward) {
                throw new Error("Reward not found");
            }
            if (customer.points < reward.pointsCost) {
                (0, use_toast_1.toast)({
                    title: "Insufficient points",
                    description: `You need ${reward.pointsCost - customer.points} more points to redeem this reward`,
                    variant: "destructive",
                });
                return;
            }
            const response = await fetch("/api/customer/loyalty/redeem", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    customerId: customer.id,
                    rewardId,
                    tableNumber: tableNumber || undefined,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to redeem reward");
            }
            const data = await response.json();
            // Update customer data with new points balance
            setCustomer(Object.assign(Object.assign({}, customer), { points: data.newPointsBalance }));
            (0, use_toast_1.toast)({
                title: "Reward redeemed!",
                description: `You've redeemed ${reward.name}. Show this to your server.`,
            });
        }
        catch (error) {
            console.error("Error redeeming reward:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to redeem reward",
                variant: "destructive",
            });
        }
    };
    const getIconForReward = (iconName) => {
        switch (iconName) {
            case "coffee":
                return <lucide_react_1.Coffee className="h-5 w-5"/>;
            case "pizza":
                return <lucide_react_1.Pizza className="h-5 w-5"/>;
            case "utensils":
                return <lucide_react_1.Utensils className="h-5 w-5"/>;
            case "ticket":
                return <lucide_react_1.Ticket className="h-5 w-5"/>;
            case "gift":
                return <lucide_react_1.Gift className="h-5 w-5"/>;
            case "credit-card":
                return <lucide_react_1.CreditCard className="h-5 w-5"/>;
            default:
                return <lucide_react_1.Gift className="h-5 w-5"/>;
        }
    };
    const getTierProgress = () => {
        if (!customer)
            return 0;
        switch (customer.tier) {
            case "bronze":
                return (customer.points / 1000) * 100;
            case "silver":
                return (customer.points / 2500) * 100;
            case "gold":
                return (customer.points / 5000) * 100;
            case "platinum":
                return 100;
            default:
                return 0;
        }
    };
    const getNextTier = () => {
        if (!customer)
            return null;
        switch (customer.tier) {
            case "bronze":
                return { name: "Silver", points: 1000 };
            case "silver":
                return { name: "Gold", points: 2500 };
            case "gold":
                return { name: "Platinum", points: 5000 };
            case "platinum":
                return null;
            default:
                return null;
        }
    };
    if (loading) {
        return (<div className="flex flex-col min-h-screen">
        <customer_header_1.CustomerHeader tableNumber={tableNumber} showBackButton title="Loyalty Program"/>

        <main className="flex-1 container max-w-lg mx-auto px-4 py-6 flex items-center justify-center">
          <div className="text-center">
            <lucide_react_1.Loader2 className="h-8 w-8 animate-spin mx-auto mb-4"/>
            <p>Loading loyalty program...</p>
          </div>
        </main>

        <customer_footer_1.CustomerFooter />
      </div>);
    }
    return (<div className="flex flex-col min-h-screen">
      <customer_header_1.CustomerHeader tableNumber={tableNumber} showBackButton title="Loyalty Program"/>

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <div className="space-y-6">
          {customer ? (<>
              <card_1.Card>
                <card_1.CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <card_1.CardTitle>{customer.name}</card_1.CardTitle>
                      <card_1.CardDescription>{customer.email}</card_1.CardDescription>
                    </div>
                    <badge_1.Badge className="uppercase">{customer.tier} Member</badge_1.Badge>
                  </div>
                </card_1.CardHeader>
                <card_1.CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold">{customer.points}</p>
                      <p className="text-sm text-muted-foreground">Available Points</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{customer.visitsCount}</p>
                      <p className="text-sm text-muted-foreground">Total Visits</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">${customer.totalSpent.toFixed(0)}</p>
                      <p className="text-sm text-muted-foreground">Total Spent</p>
                    </div>
                  </div>

                  {getNextTier() && (<div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress to {(_a = getNextTier()) === null || _a === void 0 ? void 0 : _a.name}</span>
                        <span>
                          {customer.points} / {(_b = getNextTier()) === null || _b === void 0 ? void 0 : _b.points}
                        </span>
                      </div>
                      <progress_1.Progress value={getTierProgress()} className="h-2"/>
                    </div>)}
                </card_1.CardContent>
                <card_1.CardFooter>
                  <button_1.Button variant="outline" onClick={handleLogout} className="w-full">
                    Logout
                  </button_1.Button>
                </card_1.CardFooter>
              </card_1.Card>

              <tabs_1.Tabs defaultValue="rewards">
                <tabs_1.TabsList className="grid w-full grid-cols-2">
                  <tabs_1.TabsTrigger value="rewards">Available Rewards</tabs_1.TabsTrigger>
                  <tabs_1.TabsTrigger value="history">Activity History</tabs_1.TabsTrigger>
                </tabs_1.TabsList>
                <tabs_1.TabsContent value="rewards" className="space-y-4 pt-4">
                  {rewards.length > 0 ? (rewards.map((reward) => (<card_1.Card key={reward.id}>
                        <card_1.CardContent className="p-4">
                          <div className="flex gap-4">
                            <div className="rounded-full bg-primary/10 p-3 h-12 w-12 flex items-center justify-center">
                              {getIconForReward(reward.icon)}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium">{reward.name}</h3>
                              <p className="text-sm text-muted-foreground">{reward.description}</p>
                              <div className="flex justify-between items-center mt-2">
                                <badge_1.Badge variant="outline">{reward.pointsCost} points</badge_1.Badge>
                                <button_1.Button size="sm" disabled={customer.points < reward.pointsCost || !reward.available} onClick={() => handleRedeemReward(reward.id)}>
                                  Redeem
                                </button_1.Button>
                              </div>
                            </div>
                          </div>
                        </card_1.CardContent>
                      </card_1.Card>))) : (<card_1.Card>
                      <card_1.CardContent className="p-6 text-center">
                        <p className="text-muted-foreground">No rewards available at the moment</p>
                      </card_1.CardContent>
                    </card_1.Card>)}
                </tabs_1.TabsContent>
                <tabs_1.TabsContent value="history" className="space-y-4 pt-4">
                  <card_1.Card>
                    <card_1.CardContent className="p-0">
                      <div className="divide-y">
                        <div className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Order #12345</p>
                              <p className="text-sm text-muted-foreground">May 15, 2023</p>
                            </div>
                            <badge_1.Badge variant="outline" className="bg-green-50 text-green-700">
                              +50 points
                            </badge_1.Badge>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Free Dessert Redeemed</p>
                              <p className="text-sm text-muted-foreground">April 28, 2023</p>
                            </div>
                            <badge_1.Badge variant="outline" className="bg-red-50 text-red-700">
                              -200 points
                            </badge_1.Badge>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Order #12288</p>
                              <p className="text-sm text-muted-foreground">April 20, 2023</p>
                            </div>
                            <badge_1.Badge variant="outline" className="bg-green-50 text-green-700">
                              +45 points
                            </badge_1.Badge>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Welcome Bonus</p>
                              <p className="text-sm text-muted-foreground">April 10, 2023</p>
                            </div>
                            <badge_1.Badge variant="outline" className="bg-green-50 text-green-700">
                              +100 points
                            </badge_1.Badge>
                          </div>
                        </div>
                      </div>
                    </card_1.CardContent>
                  </card_1.Card>
                </tabs_1.TabsContent>
              </tabs_1.Tabs>
            </>) : (<card_1.Card>
              <card_1.CardHeader>
                <card_1.CardTitle>Join Our Loyalty Program</card_1.CardTitle>
                <card_1.CardDescription>Earn points with every purchase and redeem them for exclusive rewards</card_1.CardDescription>
              </card_1.CardHeader>
              <card_1.CardContent className="space-y-4">
                <div className="space-y-2">
                  <label_1.Label htmlFor="email">Email</label_1.Label>
                  <input_1.Input id="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)}/>
                </div>
                <div className="space-y-2">
                  <label_1.Label htmlFor="phone">Phone Number</label_1.Label>
                  <input_1.Input id="phone" type="tel" placeholder="Enter your phone number" value={phone} onChange={(e) => setPhone(e.target.value)}/>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button_1.Button variant="outline" onClick={handleLogin} disabled={isSubmitting}>
                    {isSubmitting ? (<>
                        <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                        Loading...
                      </>) : ("Login")}
                  </button_1.Button>
                  <button_1.Button onClick={handleSignup} disabled={isSubmitting}>
                    {isSubmitting ? (<>
                        <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                        Loading...
                      </>) : ("Sign Up")}
                  </button_1.Button>
                </div>
              </card_1.CardContent>
              <card_1.CardFooter className="flex-col space-y-4">
                <separator_1.Separator />
                <div className="space-y-2 w-full">
                  <h3 className="font-medium text-center">Program Benefits</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <lucide_react_1.Award className="h-5 w-5 text-primary"/>
                      <span className="text-sm">Earn points on every purchase</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <lucide_react_1.Gift className="h-5 w-5 text-primary"/>
                      <span className="text-sm">Exclusive rewards and offers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <lucide_react_1.CreditCard className="h-5 w-5 text-primary"/>
                      <span className="text-sm">Birthday specials</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <lucide_react_1.Ticket className="h-5 w-5 text-primary"/>
                      <span className="text-sm">Special event invitations</span>
                    </div>
                  </div>
                </div>
              </card_1.CardFooter>
            </card_1.Card>)}
        </div>
      </main>

      <customer_footer_1.CustomerFooter />
    </div>);
}
