"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ProfilePage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const AuthContext_1 = require("@/context/AuthContext");
const user_profile_form_1 = require("@/components/auth/user-profile-form");
const change_password_form_1 = require("@/components/auth/change-password-form");
const shift_tracker_1 = require("@/components/auth/shift-tracker");
const tabs_1 = require("@/components/ui/tabs");
function ProfilePage() {
    const { state } = (0, AuthContext_1.useAuth)();
    const router = (0, navigation_1.useRouter)();
    // Redirect to login if not authenticated
    (0, react_1.useEffect)(() => {
        if (!state.isAuthenticated && !state.loading) {
            router.push("/login");
        }
    }, [state.isAuthenticated, state.loading, router]);
    if (state.loading) {
        return (<div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>);
    }
    if (!state.isAuthenticated) {
        return null; // Will redirect to login
    }
    return (<div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <tabs_1.Tabs defaultValue="profile">
            <tabs_1.TabsList className="mb-4">
              <tabs_1.TabsTrigger value="profile">Profile Information</tabs_1.TabsTrigger>
              <tabs_1.TabsTrigger value="password">Change Password</tabs_1.TabsTrigger>
            </tabs_1.TabsList>

            <tabs_1.TabsContent value="profile">
              <user_profile_form_1.UserProfileForm />
            </tabs_1.TabsContent>

            <tabs_1.TabsContent value="password">
              <change_password_form_1.ChangePasswordForm />
            </tabs_1.TabsContent>
          </tabs_1.Tabs>
        </div>

        <div>
          <shift_tracker_1.ShiftTracker />
        </div>
      </div>
    </div>);
}
