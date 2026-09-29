"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = HomePage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const AuthContext_1 = require("@/context/AuthContext");
const lucide_react_1 = require("lucide-react");
function HomePage() {
    const router = (0, navigation_1.useRouter)();
    const { state } = (0, AuthContext_1.useAuth)();
    (0, react_1.useEffect)(() => {
        if (!state.loading) {
            if (state.isAuthenticated) {
                router.push("/dashboard");
            }
            else {
                router.push("/login");
            }
        }
    }, [state.loading, state.isAuthenticated, router]);
    return (<div className="flex h-screen items-center justify-center">
      <lucide_react_1.Loader2 className="h-8 w-8 animate-spin text-primary"/>
    </div>);
}
