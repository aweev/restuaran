"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterForm = RegisterForm;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const link_1 = __importDefault(require("next/link"));
const AuthContext_1 = require("@/context/AuthContext");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const card_1 = require("@/components/ui/card");
const alert_1 = require("@/components/ui/alert");
const lucide_react_1 = require("lucide-react");
const select_1 = require("@/components/ui/select");
function RegisterForm() {
    const { register, state } = (0, AuthContext_1.useAuth)();
    const router = (0, navigation_1.useRouter)();
    const [formData, setFormData] = (0, react_1.useState)({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "server",
        phone: "",
        address: "",
    });
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => (Object.assign(Object.assign({}, prev), { [name]: value })));
        if (error)
            setError(null);
    };
    const handleRoleChange = (value) => {
        setFormData((prev) => (Object.assign(Object.assign({}, prev), { role: value })));
        if (error)
            setError(null);
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            setIsSubmitting(false);
            return;
        }
        try {
            await register({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: formData.role,
                phone: formData.phone,
                address: formData.address,
            });
        }
        catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            }
            else if (typeof err === "string") {
                setError(err);
            }
            else {
                setError("An error occurred during registration");
            }
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<card_1.Card className="w-[500px] shadow-lg">
      <card_1.CardHeader className="space-y-1">
        <card_1.CardTitle className="text-2xl font-bold">Create new account</card_1.CardTitle>
        <card_1.CardDescription>Register a new staff member</card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (<alert_1.Alert variant="destructive">
              <lucide_react_1.AlertCircle className="h-4 w-4"/>
              <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
            </alert_1.Alert>)}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label_1.Label htmlFor="name">Full Name</label_1.Label>
              <input_1.Input id="name" name="name" value={formData.name} onChange={handleChange} required/>
            </div>

            <div className="space-y-2">
              <label_1.Label htmlFor="email">Email</label_1.Label>
              <input_1.Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label_1.Label htmlFor="password">Password</label_1.Label>
              <input_1.Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required/>
            </div>

            <div className="space-y-2">
              <label_1.Label htmlFor="confirmPassword">Confirm Password</label_1.Label>
              <input_1.Input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required/>
            </div>
          </div>

          <div className="space-y-2">
            <label_1.Label htmlFor="role">Role</label_1.Label>
            <select_1.Select value={formData.role} onValueChange={handleRoleChange}>
              <select_1.SelectTrigger id="role">
                <select_1.SelectValue placeholder="Select role"/>
              </select_1.SelectTrigger>
              <select_1.SelectContent>
                <select_1.SelectItem value="admin">Administrator</select_1.SelectItem>
                <select_1.SelectItem value="manager">Manager</select_1.SelectItem>
                <select_1.SelectItem value="server">Server</select_1.SelectItem>
                <select_1.SelectItem value="kitchen">Kitchen Staff</select_1.SelectItem>
                <select_1.SelectItem value="cashier">Cashier</select_1.SelectItem>
              </select_1.SelectContent>
            </select_1.Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label_1.Label htmlFor="phone">Phone Number</label_1.Label>
              <input_1.Input id="phone" name="phone" value={formData.phone} onChange={handleChange}/>
            </div>

            <div className="space-y-2">
              <label_1.Label htmlFor="address">Address</label_1.Label>
              <input_1.Input id="address" name="address" value={formData.address} onChange={handleChange}/>
            </div>
          </div>

          <button_1.Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button_1.Button>
        </form>
      </card_1.CardContent>
      <card_1.CardFooter className="flex justify-center border-t p-4">
        <link_1.default href="/login" className="text-sm text-primary hover:underline">
          Already have an account? Sign in
        </link_1.default>
      </card_1.CardFooter>
    </card_1.Card>);
}
