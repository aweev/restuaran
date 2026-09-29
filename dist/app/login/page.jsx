"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LoginPage;
const react_1 = require("react");
const login_form_1 = require("@/components/auth/login-form");
const alert_1 = require("@/components/ui/alert");
const lucide_react_1 = require("lucide-react");
function LoginPage() {
    const [error, setError] = (0, react_1.useState)(null);
    return (<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">CHILI POS</h1>
          <p className="mt-2 text-sm text-gray-600">Restaurant Point of Sale System</p>
        </div>

        {error && (<alert_1.Alert variant="destructive" className="mb-4">
            <lucide_react_1.AlertCircle className="h-4 w-4"/>
            <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
          </alert_1.Alert>)}

        <login_form_1.LoginForm onError={setError}/>
      </div>
    </div>);
}
