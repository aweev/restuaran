"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileNav = MobileNav;
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const button_1 = require("@/components/ui/button");
const sheet_1 = require("@/components/ui/sheet");
const dashboard_nav_1 = require("@/components/dashboard/dashboard-nav");
function MobileNav() {
    const [open, setOpen] = (0, react_1.useState)(false);
    return (<sheet_1.Sheet open={open} onOpenChange={setOpen}>
      <sheet_1.SheetTrigger asChild>
        <button_1.Button variant="ghost" size="icon" className="md:hidden">
          <lucide_react_1.Menu className="h-5 w-5"/>
          <span className="sr-only">Toggle navigation menu</span>
        </button_1.Button>
      </sheet_1.SheetTrigger>
      <sheet_1.SheetContent side="left" className="pr-0">
        <sheet_1.SheetHeader>
          <sheet_1.SheetTitle className="text-left font-bold">Restaurant POS</sheet_1.SheetTitle>
        </sheet_1.SheetHeader>
        <div className="px-1 py-4">
          <dashboard_nav_1.DashboardNav />
        </div>
      </sheet_1.SheetContent>
    </sheet_1.Sheet>);
}
