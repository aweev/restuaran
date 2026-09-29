"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DashboardLayout;
const useMediaQuery_1 = require("@/hooks/useMediaQuery");
const dashboard_nav_1 = require("@/components/dashboard/dashboard-nav");
const dashboard_header_1 = require("@/components/dashboard/dashboard-header");
function DashboardLayout({ children }) {
    const isDesktop = (0, useMediaQuery_1.useMediaQuery)("(min-width: 768px)");
    return (<div className="flex min-h-screen flex-col">
      <dashboard_header_1.DashboardHeader />
      <div className="flex flex-1">
        {isDesktop ? (<aside className="hidden w-64 border-r bg-background md:block">
            <dashboard_nav_1.DashboardNav />
          </aside>) : null}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>);
}
