"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalShortcutsHandler = GlobalShortcutsHandler;
const navigation_1 = require("next/navigation");
const useKeyboardShortcuts_1 = require("@/hooks/useKeyboardShortcuts");
function GlobalShortcutsHandler() {
    const router = (0, navigation_1.useRouter)();
    (0, useKeyboardShortcuts_1.useKeyboardShortcuts)([
        {
            key: "F2",
            callback: () => router.push("/dashboard/orders"),
            description: "Quick Navigate to Orders",
        },
        {
            key: "F4",
            callback: () => router.push("/dashboard/tables"),
            description: "Quick Navigate to Tables",
        },
        {
            key: "F8",
            callback: () => router.push("/dashboard/kitchen"),
            description: "Quick Navigate to Kitchen Display",
        },
    ]);
    return null;
}
