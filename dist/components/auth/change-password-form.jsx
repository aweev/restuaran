"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordForm = ChangePasswordForm;
const react_1 = require("react");
const AuthContext_1 = require("@/context/AuthContext");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const card_1 = require("@/components/ui/card");
const alert_1 = require("@/components/ui/alert");
const lucide_react_1 = require("lucide-react");
function ChangePasswordForm() {
    const { changePassword } = (0, AuthContext_1.useAuth)();
    const [currentPassword, setCurrentPassword] = (0, react_1.useState)("");
    const [newPassword, setNewPassword] = (0, react_1.useState)("");
    const [confirmPassword, setConfirmPassword] = (0, react_1.useState)("");
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const [success, setSuccess] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        if (newPassword !== confirmPassword) {
            setError("New passwords do not match");
            setIsSubmitting(false);
            return;
        }
        try {
            await changePassword({ currentPassword, newPassword, confirmPassword });
            setSuccess(true);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
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
    return (<card_1.Card>
      <card_1.CardHeader className="space-y-1">
        <card_1.CardTitle className="text-xl">Change Password</card_1.CardTitle>
        <card_1.CardDescription>Update your password to keep your account secure</card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent>
        {success && (<alert_1.Alert className="mb-4 bg-green-50 border-green-200">
            <lucide_react_1.CheckCircle2 className="h-4 w-4 text-green-600"/>
            <alert_1.AlertDescription className="text-green-600">Your password has been updated successfully.</alert_1.AlertDescription>
          </alert_1.Alert>)}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (<alert_1.Alert variant="destructive">
              <lucide_react_1.AlertCircle className="h-4 w-4"/>
              <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
            </alert_1.Alert>)}

          <div className="space-y-2">
            <label_1.Label htmlFor="currentPassword">Current Password</label_1.Label>
            <input_1.Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => {
            setCurrentPassword(e.target.value);
            if (error)
                setError(null);
        }} required/>
          </div>

          <div className="space-y-2">
            <label_1.Label htmlFor="newPassword">New Password</label_1.Label>
            <input_1.Input id="newPassword" type="password" value={newPassword} onChange={(e) => {
            setNewPassword(e.target.value);
            if (error)
                setError(null);
        }} required/>
          </div>

          <div className="space-y-2">
            <label_1.Label htmlFor="confirmPassword">Confirm New Password</label_1.Label>
            <input_1.Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (error)
                setError(null);
        }} required/>
          </div>

          <button_1.Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Password"}
          </button_1.Button>
        </form>
      </card_1.CardContent>
    </card_1.Card>);
}
