"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginForm = LoginForm;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const AuthContext_1 = require("@/context/AuthContext");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const card_1 = require("@/components/ui/card");
const lucide_react_1 = require("lucide-react");
function LoginForm({ onError }) {
    const { login } = (0, AuthContext_1.useAuth)();
    const router = (0, navigation_1.useRouter)();
    const [email, setEmail] = (0, react_1.useState)("");
    const [password, setPassword] = (0, react_1.useState)("");
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await login({ email, password });
            router.push("/dashboard");
        }
        catch (error) {
            console.error("Login error:", error);
            if (onError) {
                onError(error instanceof Error ? error.message : "Failed to login. Please try again.");
            }
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<card_1.Card className="w-full shadow-lg">
      <card_1.CardHeader className="space-y-1">
        <card_1.CardTitle className="text-2xl font-bold">Sign in</card_1.CardTitle>
        <card_1.CardDescription>Enter your credentials to access your account</card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label_1.Label htmlFor="email">Email</label_1.Label>
            <input_1.Input id="email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"/>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label_1.Label htmlFor="password">Password</label_1.Label>
            </div>
            <input_1.Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"/>
          </div>

          <button_1.Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (<>
                <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/> Signing in...
              </>) : ("Sign in")}
          </button_1.Button>
        </form>
      </card_1.CardContent>
      <card_1.CardFooter className="flex justify-center border-t p-4">
        <p className="text-sm text-muted-foreground">Use admin@restaurant.com / admin123 for admin access</p>
      </card_1.CardFooter>
    </card_1.Card>);
}
