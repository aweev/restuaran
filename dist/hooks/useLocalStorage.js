"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLocalStorage = useLocalStorage;
const react_1 = require("react");
function useLocalStorage(key, initialValue) {
    // State to store our value
    // Pass initial state function to useState so logic is only executed once
    const [storedValue, setStoredValue] = (0, react_1.useState)(() => {
        if (typeof window === "undefined") {
            return initialValue;
        }
        try {
            // Get from local storage by key
            const item = window.localStorage.getItem(key);
            // Parse stored json or if none return initialValue
            return item ? JSON.parse(item) : initialValue;
        }
        catch (error) {
            // If error also return initialValue
            console.error("Error reading from localStorage", error);
            return initialValue;
        }
    });
    // Return a wrapped version of useState's setter function that
    // persists the new value to localStorage.
    const setValue = (0, react_1.useCallback)((value) => {
        try {
            setStoredValue((prevStoredValue) => {
                const valueToStore = value instanceof Function ? value(prevStoredValue) : value;
                if (typeof window !== "undefined") {
                    window.localStorage.setItem(key, JSON.stringify(valueToStore));
                }
                return valueToStore;
            });
        }
        catch (error) {
            console.error("Error writing to localStorage", error);
        }
    }, [key]);
    // Listen for changes to this localStorage key from other tabs/windows
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined") {
            return;
        }
        const handleStorageChange = (e) => {
            if (e.key === key && e.newValue) {
                try {
                    setStoredValue(JSON.parse(e.newValue));
                }
                catch (error) {
                    console.error("Error parsing localStorage change", error);
                }
            }
        };
        // Listen for storage events
        window.addEventListener("storage", handleStorageChange);
        return () => {
            window.removeEventListener("storage", handleStorageChange);
        };
    }, [key]);
    return [storedValue, setValue];
}
