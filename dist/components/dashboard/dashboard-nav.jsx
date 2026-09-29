"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardNav = DashboardNav;
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const utils_1 = require("@/lib/utils");
const lucide_react_1 = require("lucide-react");
const items = [
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: lucide_react_1.Home,
    },
    {
        title: "Orders",
        href: "/dashboard/orders",
        icon: lucide_react_1.ShoppingCart,
    },
    {
        title: "Menu",
        href: "/dashboard/menu",
        icon: lucide_react_1.Coffee,
    },
    {
        title: "Tables",
        href: "/dashboard/tables",
        icon: lucide_react_1.LayoutGrid,
    },
    {
        title: "Table Management",
        href: "/dashboard/tables/management",
        icon: lucide_react_1.Utensils,
    },
    {
        title: "Reservations",
        href: "/dashboard/reservations",
        icon: lucide_react_1.Calendar,
    },
    {
        title: "Kitchen",
        href: "/dashboard/kitchen",
        icon: lucide_react_1.Package,
    },
    {
        title: "Reports",
        href: "/dashboard/reports",
        icon: lucide_react_1.FileText,
    },
    {
        title: "Analytics",
        href: "/dashboard/analytics",
        icon: lucide_react_1.BarChart3,
    },
    {
        title: "Inventory",
        href: "/dashboard/inventory",
        icon: lucide_react_1.Package,
    },
    {
        title: "Staff",
        href: "/dashboard/staff",
        icon: lucide_react_1.Users,
    },
    {
        title: "Settings",
        href: "/dashboard/settings",
        icon: lucide_react_1.Settings,
    },
];
function DashboardNav() {
    const pathname = (0, navigation_1.usePathname)();
    return (<nav className="grid items-start gap-2">
      {items.map((item, index) => (<link_1.default key={index} href={item.href} className={(0, utils_1.cn)("group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground", pathname === item.href ? "bg-accent" : "transparent")}>
          <item.icon className="mr-2 h-4 w-4"/>
          <span>{item.title}</span>
        </link_1.default>))}
    </nav>);
}
