"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeToggle = ThemeToggle;
const lucide_react_1 = require("lucide-react");
const next_themes_1 = require("next-themes");
const button_1 = require("@/components/ui/button");
const dropdown_menu_1 = require("@/components/ui/dropdown-menu");
const react_1 = require("react");
const useKeyboardShortcuts_1 = require("@/hooks/useKeyboardShortcuts");
function ThemeToggle() {
    const { setTheme, theme } = (0, next_themes_1.useTheme)();
    const [mounted, setMounted] = (0, react_1.useState)(false);
    // Register keyboard shortcut for theme toggle
    (0, useKeyboardShortcuts_1.useKeyboardShortcuts)([
        {
            key: "d",
            ctrlKey: true,
            altKey: true,
            callback: () => {
                setTheme(theme === "dark" ? "light" : "dark");
            },
            description: "Toggle between light and dark mode",
        },
    ]);
    // Avoid hydration mismatch
    (0, react_1.useEffect)(() => {
        setMounted(true);
    }, []);
    if (!mounted) {
        return null;
    }
    return (<dropdown_menu_1.DropdownMenu>
      <dropdown_menu_1.DropdownMenuTrigger asChild>
        <button_1.Button variant="outline" size="icon" className="relative">
          <lucide_react_1.Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"/>
          <lucide_react_1.Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"/>
          <span className="sr-only">Toggle theme</span>
        </button_1.Button>
      </dropdown_menu_1.DropdownMenuTrigger>
      <dropdown_menu_1.DropdownMenuContent align="end">
        <dropdown_menu_1.DropdownMenuItem onClick={() => setTheme("light")}>
          <lucide_react_1.Sun className="mr-2 h-4 w-4"/>
          <span>Light</span>
        </dropdown_menu_1.DropdownMenuItem>
        <dropdown_menu_1.DropdownMenuItem onClick={() => setTheme("dark")}>
          <lucide_react_1.Moon className="mr-2 h-4 w-4"/>
          <span>Dark</span>
        </dropdown_menu_1.DropdownMenuItem>
        <dropdown_menu_1.DropdownMenuItem onClick={() => setTheme("system")}>
          <lucide_react_1.Laptop className="mr-2 h-4 w-4"/>
          <span>System</span>
        </dropdown_menu_1.DropdownMenuItem>
      </dropdown_menu_1.DropdownMenuContent>
    </dropdown_menu_1.DropdownMenu>);
}
