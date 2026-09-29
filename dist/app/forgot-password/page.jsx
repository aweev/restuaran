"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ForgotPasswordPage;
const forgot_password_form_1 = require("@/components/auth/forgot-password-form");
function ForgotPasswordPage() {
    return (<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">CHILI POS</h1>
          <p className="mt-2 text-sm text-gray-600">Restaurant Point of Sale System</p>
        </div>

        <forgot_password_form_1.ForgotPasswordForm />
      </div>
    </div>);
}
