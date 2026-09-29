"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useKeyboardShortcuts = useKeyboardShortcuts;
const react_1 = require("react");
function useKeyboardShortcuts(shortcuts) {
    (0, react_1.useEffect)(() => {
        const handleKeyDown = (event) => {
            shortcuts.forEach((shortcut) => {
                const matchesKey = event.key.toLowerCase() === shortcut.key.toLowerCase();
                const matchesCtrl = shortcut.ctrlKey ? (event.ctrlKey || event.metaKey) : true;
                const matchesAlt = shortcut.altKey ? event.altKey : true;
                const matchesShift = shortcut.shiftKey ? event.shiftKey : true;
                if (matchesKey && matchesCtrl && matchesAlt && matchesShift) {
                    event.preventDefault();
                    shortcut.callback();
                }
            });
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [shortcuts]);
}
