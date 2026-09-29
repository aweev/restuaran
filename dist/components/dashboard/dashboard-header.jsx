"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardHeader = DashboardHeader;
const AuthContext_1 = require("@/context/AuthContext");
const button_1 = require("@/components/ui/button");
const notification_center_1 = require("@/components/notifications/notification-center");
const mode_toggle_1 = require("@/components/mode-toggle");
const mobile_nav_1 = require("@/components/layout/mobile-nav");
const avatar_1 = require("@/components/ui/avatar");
const dropdown_menu_1 = require("@/components/ui/dropdown-menu");
const lucide_react_1 = require("lucide-react");
const navigation_1 = require("next/navigation");
function DashboardHeader() {
    var _a, _b, _c, _d, _e;
    const { state: authState, logout } = (0, AuthContext_1.useAuth)();
    const router = (0, navigation_1.useRouter)();
    const handleLogout = () => {
        logout();
        router.push("/login");
    };
    const getInitials = (name) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();
    };
    return (<header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <mobile_nav_1.MobileNav />
        <h1 className="text-xl font-semibold md:hidden">Restaurant POS</h1>
      </div>
      <div className="flex items-center gap-4">
        <notification_center_1.NotificationCenter />
        <mode_toggle_1.ModeToggle />
        <dropdown_menu_1.DropdownMenu>
          <dropdown_menu_1.DropdownMenuTrigger asChild>
            <button_1.Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <avatar_1.Avatar className="h-8 w-8">
                <avatar_1.AvatarImage src={((_a = authState.user) === null || _a === void 0 ? void 0 : _a.avatar) || "/placeholder.svg"} alt={((_b = authState.user) === null || _b === void 0 ? void 0 : _b.name) || ""}/>
                <avatar_1.AvatarFallback>{((_c = authState.user) === null || _c === void 0 ? void 0 : _c.name) ? getInitials(authState.user.name) : "U"}</avatar_1.AvatarFallback>
              </avatar_1.Avatar>
            </button_1.Button>
          </dropdown_menu_1.DropdownMenuTrigger>
          <dropdown_menu_1.DropdownMenuContent className="w-56" align="end" forceMount>
            <dropdown_menu_1.DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{(_d = authState.user) === null || _d === void 0 ? void 0 : _d.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{(_e = authState.user) === null || _e === void 0 ? void 0 : _e.email}</p>
              </div>
            </dropdown_menu_1.DropdownMenuLabel>
            <dropdown_menu_1.DropdownMenuSeparator />
            <dropdown_menu_1.DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
              <lucide_react_1.User className="mr-2 h-4 w-4"/>
              <span>Profile</span>
            </dropdown_menu_1.DropdownMenuItem>
            <dropdown_menu_1.DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
              <lucide_react_1.Settings className="mr-2 h-4 w-4"/>
              <span>Settings</span>
            </dropdown_menu_1.DropdownMenuItem>
            <dropdown_menu_1.DropdownMenuSeparator />
            <dropdown_menu_1.DropdownMenuItem onClick={handleLogout}>
              <lucide_react_1.LogOut className="mr-2 h-4 w-4"/>
              <span>Log out</span>
            </dropdown_menu_1.DropdownMenuItem>
          </dropdown_menu_1.DropdownMenuContent>
        </dropdown_menu_1.DropdownMenu>
      </div>
    </header>);
}
