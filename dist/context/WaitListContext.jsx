"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitListProvider = WaitListProvider;
exports.useWaitList = useWaitList;
const react_1 = require("react");
const AuthContext_1 = require("./AuthContext");
// Create the context
const WaitListContext = (0, react_1.createContext)(undefined);
// Initial state
const initialState = {
    entries: [],
    loading: false,
    error: null,
};
// Reducer function
function waitListReducer(state, action) {
    switch (action.type) {
        case "FETCH_ENTRIES_REQUEST":
            return Object.assign(Object.assign({}, state), { loading: true, error: null });
        case "FETCH_ENTRIES_SUCCESS":
            return Object.assign(Object.assign({}, state), { entries: action.payload, loading: false });
        case "FETCH_ENTRIES_FAILURE":
            return Object.assign(Object.assign({}, state), { loading: false, error: action.payload });
        case "ADD_ENTRY":
            return Object.assign(Object.assign({}, state), { entries: [...state.entries, action.payload] });
        case "REMOVE_ENTRY":
            return Object.assign(Object.assign({}, state), { entries: state.entries.filter((entry) => entry.id !== action.payload) });
        case "NOTIFY_CUSTOMER":
            return Object.assign(Object.assign({}, state), { entries: state.entries.map((entry) => entry.id === action.payload ? Object.assign(Object.assign({}, entry), { notified: true, updatedAt: new Date().toISOString() }) : entry) });
        case "SEAT_CUSTOMER":
            return Object.assign(Object.assign({}, state), { entries: state.entries.filter((entry) => entry.id !== action.payload.id) });
        default:
            return state;
    }
}
// Provider component
function WaitListProvider({ children }) {
    const [state, dispatch] = (0, react_1.useReducer)(waitListReducer, initialState);
    const { state: authState } = (0, AuthContext_1.useAuth)();
    // Fetch wait list entries
    const fetchEntries = (0, react_1.useCallback)(async () => {
        if (!authState.token)
            return;
        dispatch({ type: "FETCH_ENTRIES_REQUEST" });
        try {
            const response = await fetch("/api/waitlist", {
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to fetch wait list entries");
            }
            const data = await response.json();
            dispatch({ type: "FETCH_ENTRIES_SUCCESS", payload: data });
        }
        catch (error) {
            console.error("Error fetching wait list entries:", error);
            dispatch({
                type: "FETCH_ENTRIES_FAILURE",
                payload: error instanceof Error ? error.message : "Failed to fetch wait list entries",
            });
        }
    }, [authState.token]);
    // Add entry to wait list
    const addEntry = (0, react_1.useCallback)(async (entry) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch("/api/waitlist", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify(entry),
            });
            if (!response.ok) {
                throw new Error("Failed to add entry to wait list");
            }
            const data = await response.json();
            dispatch({ type: "ADD_ENTRY", payload: data });
        }
        catch (error) {
            console.error("Error adding entry to wait list:", error);
            throw error;
        }
    }, [authState.token]);
    // Remove entry from wait list
    const removeEntry = (0, react_1.useCallback)(async (id) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch(`/api/waitlist/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to remove entry from wait list");
            }
            dispatch({ type: "REMOVE_ENTRY", payload: id });
        }
        catch (error) {
            console.error("Error removing entry from wait list:", error);
            throw error;
        }
    }, [authState.token]);
    // Notify customer
    const notifyCustomer = (0, react_1.useCallback)(async (id) => {
        if (!authState.token)
            return;
        try {
            const entry = state.entries.find((e) => e.id === id);
            if (!entry) {
                throw new Error("Entry not found");
            }
            // If there's a phone number, send SMS notification
            if (entry.phoneNumber) {
                const response = await fetch(`/api/waitlist/${id}/notify`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authState.token}`,
                    },
                });
                if (!response.ok) {
                    throw new Error("Failed to send notification");
                }
            }
            else {
                // If no phone number, just mark as notified
                const response = await fetch(`/api/waitlist/${id}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authState.token}`,
                    },
                    body: JSON.stringify({ notified: true }),
                });
                if (!response.ok) {
                    throw new Error("Failed to update entry");
                }
            }
            dispatch({ type: "NOTIFY_CUSTOMER", payload: id });
        }
        catch (error) {
            console.error("Error notifying customer:", error);
            throw error;
        }
    }, [authState.token, state.entries]);
    // Seat customer
    const seatCustomer = (0, react_1.useCallback)(async (id, tableId) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch(`/api/waitlist/${id}/seat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({ tableId }),
            });
            if (!response.ok) {
                throw new Error("Failed to seat customer");
            }
            dispatch({ type: "SEAT_CUSTOMER", payload: { id, tableId } });
        }
        catch (error) {
            console.error("Error seating customer:", error);
            throw error;
        }
    }, [authState.token]);
    const value = {
        state,
        fetchEntries,
        addEntry,
        removeEntry,
        notifyCustomer,
        seatCustomer,
    };
    return <WaitListContext.Provider value={value}>{children}</WaitListContext.Provider>;
}
// Custom hook
function useWaitList() {
    const context = (0, react_1.useContext)(WaitListContext);
    if (context === undefined) {
        throw new Error("useWaitList must be used within a WaitListProvider");
    }
    return context;
}
