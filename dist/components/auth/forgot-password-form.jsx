"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForgotPasswordForm = ForgotPasswordForm;
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
function ForgotPasswordForm() {
    const { requestPasswordReset, clearError } = (0, AuthContext_1.useAuth)();
    const router = (0, navigation_1.useRouter)();
    const [email, setEmail] = (0, react_1.useState)("");
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const [success, setSuccess] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            await requestPasswordReset(email);
            setSuccess(true);
        }
        catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            }
            else {
                setError("An error occurred. Please try again.");
            }
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<card_1.Card className="w-[400px] shadow-lg">
      <card_1.CardHeader className="space-y-1">
        <card_1.CardTitle className="text-2xl font-bold">Reset password</card_1.CardTitle>
        <card_1.CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your password
        </card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent>
        {success ? (<alert_1.Alert className="bg-green-50 border-green-200">
            <lucide_react_1.CheckCircle2 className="h-4 w-4 text-green-600"/>
            <alert_1.AlertDescription className="text-green-600">
              If an account exists with that email, we&apos;ve sent a password reset link.
            </alert_1.AlertDescription>
          </alert_1.Alert>) : (<form onSubmit={handleSubmit} className="space-y-4">
            {error && (<alert_1.Alert variant="destructive">
                <lucide_react_1.AlertCircle className="h-4 w-4"/>
                <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
              </alert_1.Alert>)}

            <div className="space-y-2">
              <label_1.Label htmlFor="email">Email</label_1.Label>
              <input_1.Input id="email" type="email" placeholder="name@example.com" value={email} onChange={(e) => {
                setEmail(e.target.value);
                if (error)
                    setError(null);
            }} required/>
            </div>

            <button_1.Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send reset link"}
            </button_1.Button>
          </form>)}
      </card_1.CardContent>
      <card_1.CardFooter className="flex justify-center border-t p-4">
        <link_1.default href="/login" className="text-sm text-primary hover:underline">
          Back to login
        </link_1.default>
      </card_1.CardFooter>
    </card_1.Card>);
}
