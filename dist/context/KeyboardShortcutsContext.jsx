"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyboardShortcutsProvider = KeyboardShortcutsProvider;
exports.useKeyboardShortcutsContext = useKeyboardShortcutsContext;
const react_1 = require("react");
const KeyboardShortcutsContext = (0, react_1.createContext)(undefined);
function KeyboardShortcutsProvider({ children }) {
    const [shortcuts, setShortcuts] = (0, react_1.useState)([]);
    const [isHelpDialogOpen, setIsHelpDialogOpen] = (0, react_1.useState)(false);
    const registerShortcut = (shortcut) => {
        setShortcuts((prev) => {
            // Replace if exists, otherwise add
            const exists = prev.some((s) => s.id === shortcut.id);
            if (exists) {
                return prev.map((s) => (s.id === shortcut.id ? shortcut : s));
            }
            return [...prev, shortcut];
        });
    };
    const unregisterShortcut = (id) => {
        setShortcuts((prev) => prev.filter((s) => s.id !== id));
    };
    const openHelpDialog = () => setIsHelpDialogOpen(true);
    const closeHelpDialog = () => setIsHelpDialogOpen(false);
    (0, react_1.useEffect)(() => {
        // Register global keyboard shortcut handler
        const handleKeyDown = (e) => {
            // Skip if user is typing in an input, textarea, or select
            if (e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target instanceof HTMLSelectElement) {
                return;
            }
            // Check for help dialog shortcut (?)
            if (e.key === "?" && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                openHelpDialog();
                return;
            }
            // Check for registered shortcuts
            shortcuts.forEach((shortcut) => {
                const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
                const ctrlMatch = !!shortcut.ctrlKey === e.ctrlKey;
                const altMatch = !!shortcut.altKey === e.altKey;
                const shiftMatch = !!shortcut.shiftKey === e.shiftKey;
                if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
                    e.preventDefault();
                    shortcut.callback();
                }
            });
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [shortcuts]);
    // Register default shortcuts
    (0, react_1.useEffect)(() => {
        registerShortcut({
            id: "help-dialog",
            key: "?",
            description: "Show keyboard shortcuts",
            category: "General",
            callback: openHelpDialog,
        });
        registerShortcut({
            id: "dashboard",
            key: "d",
            description: "Go to dashboard",
            category: "Navigation",
            callback: () => {
                window.location.href = "/dashboard";
            },
        });
        registerShortcut({
            id: "orders",
            key: "o",
            description: "Go to orders",
            category: "Navigation",
            callback: () => {
                window.location.href = "/dashboard/orders";
            },
        });
        registerShortcut({
            id: "menu",
            key: "m",
            description: "Go to menu",
            category: "Navigation",
            callback: () => {
                window.location.href = "/dashboard/menu";
            },
        });
        registerShortcut({
            id: "tables",
            key: "t",
            description: "Go to tables",
            category: "Navigation",
            callback: () => {
                window.location.href = "/dashboard/tables";
            },
        });
        registerShortcut({
            id: "new-order",
            key: "n",
            description: "Create new order",
            category: "Orders",
            callback: () => {
                window.location.href = "/dashboard/orders/new";
            },
        });
    }, []);
    return (<KeyboardShortcutsContext.Provider value={{
            shortcuts,
            registerShortcut,
            unregisterShortcut,
            isHelpDialogOpen,
            openHelpDialog,
            closeHelpDialog,
        }}>
      {children}
    </KeyboardShortcutsContext.Provider>);
}
function useKeyboardShortcutsContext() {
    const context = (0, react_1.useContext)(KeyboardShortcutsContext);
    if (context === undefined) {
        throw new Error("useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider");
    }
    return context;
}
