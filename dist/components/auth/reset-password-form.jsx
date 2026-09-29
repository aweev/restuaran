"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResetPasswordForm = ResetPasswordForm;
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
function ResetPasswordForm({ token }) {
    const { resetPassword } = (0, AuthContext_1.useAuth)();
    const router = (0, navigation_1.useRouter)();
    const [password, setPassword] = (0, react_1.useState)("");
    const [confirmPassword, setConfirmPassword] = (0, react_1.useState)("");
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setIsSubmitting(false);
            return;
        }
        try {
            await resetPassword({ token, password, confirmPassword });
            router.push("/login?reset=success");
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
        <card_1.CardTitle className="text-2xl font-bold">Create new password</card_1.CardTitle>
        <card_1.CardDescription>Enter a new password for your account</card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (<alert_1.Alert variant="destructive">
              <lucide_react_1.AlertCircle className="h-4 w-4"/>
              <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
            </alert_1.Alert>)}

          <div className="space-y-2">
            <label_1.Label htmlFor="password">New Password</label_1.Label>
            <input_1.Input id="password" type="password" value={password} onChange={(e) => {
            setPassword(e.target.value);
            if (error)
                setError(null);
        }} required/>
          </div>

          <div className="space-y-2">
            <label_1.Label htmlFor="confirmPassword">Confirm Password</label_1.Label>
            <input_1.Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (error)
                setError(null);
        }} required/>
          </div>

          <button_1.Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </button_1.Button>
        </form>
      </card_1.CardContent>
      <card_1.CardFooter className="flex justify-center border-t p-4">
        <link_1.default href="/login" className="text-sm text-primary hover:underline">
          Back to login
        </link_1.default>
      </card_1.CardFooter>
    </card_1.Card>);
}
