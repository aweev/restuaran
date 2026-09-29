"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfileForm = UserProfileForm;
const react_1 = require("react");
const AuthContext_1 = require("@/context/AuthContext");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const card_1 = require("@/components/ui/card");
const alert_1 = require("@/components/ui/alert");
const lucide_react_1 = require("lucide-react");
const avatar_1 = require("@/components/ui/avatar");
function UserProfileForm() {
    const { state, updateUser } = (0, AuthContext_1.useAuth)();
    const { user } = state;
    const [formData, setFormData] = (0, react_1.useState)({
        name: "",
        email: "",
        phone: "",
        address: "",
    });
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const [success, setSuccess] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    // Load user data when component mounts
    (0, react_1.useEffect)(() => {
        if (user) {
            setFormData({
                name: user.name || "",
                email: user.email || "",
                phone: user.phone || "",
                address: user.address || "",
            });
        }
    }, [user]);
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => (Object.assign(Object.assign({}, prev), { [name]: value })));
        if (success)
            setSuccess(false);
        if (error)
            setError(null);
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            await updateUser(formData);
            setSuccess(true);
        }
        catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            }
            else if (typeof err === "string") {
                setError(err);
            }
            else {
                setError("An error occurred. Please try again.");
            }
        }
        finally {
            setIsSubmitting(false);
        }
    };
    if (!user) {
        return (<card_1.Card>
        <card_1.CardContent className="p-6">
          <p>Please log in to view your profile.</p>
        </card_1.CardContent>
      </card_1.Card>);
    }
    return (<card_1.Card>
      <card_1.CardHeader className="space-y-1">
        <div className="flex items-center gap-4">
          <avatar_1.Avatar className="h-16 w-16">
            <avatar_1.AvatarImage src={user.avatar || "/placeholder.svg?height=64&width=64"} alt={user.name}/>
            <avatar_1.AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</avatar_1.AvatarFallback>
          </avatar_1.Avatar>
          <div>
            <card_1.CardTitle className="text-xl">{user.name}</card_1.CardTitle>
            <card_1.CardDescription>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</card_1.CardDescription>
          </div>
        </div>
      </card_1.CardHeader>
      <card_1.CardContent>
        {success && (<alert_1.Alert className="mb-4 bg-green-50 border-green-200">
            <lucide_react_1.CheckCircle2 className="h-4 w-4 text-green-600"/>
            <alert_1.AlertDescription className="text-green-600">Your profile has been updated successfully.</alert_1.AlertDescription>
          </alert_1.Alert>)}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (<alert_1.Alert variant="destructive">
              <lucide_react_1.AlertCircle className="h-4 w-4"/>
              <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
            </alert_1.Alert>)}

          <div className="space-y-2">
            <label_1.Label htmlFor="name">Full Name</label_1.Label>
            <input_1.Input id="name" name="name" value={formData.name} onChange={handleChange} required/>
          </div>

          <div className="space-y-2">
            <label_1.Label htmlFor="email">Email</label_1.Label>
            <input_1.Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required/>
          </div>

          <div className="space-y-2">
            <label_1.Label htmlFor="phone">Phone Number</label_1.Label>
            <input_1.Input id="phone" name="phone" value={formData.phone || ""} onChange={handleChange}/>
          </div>

          <div className="space-y-2">
            <label_1.Label htmlFor="address">Address</label_1.Label>
            <input_1.Input id="address" name="address" value={formData.address || ""} onChange={handleChange}/>
          </div>

          <div className="flex justify-end">
            <button_1.Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button_1.Button>
          </div>
        </form>
      </card_1.CardContent>
    </card_1.Card>);
}
