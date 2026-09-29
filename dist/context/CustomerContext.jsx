"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerProvider = CustomerProvider;
exports.useCustomer = useCustomer;
const react_1 = require("react");
const AuthContext_1 = require("./AuthContext");
// Create the context
const CustomerContext = (0, react_1.createContext)(undefined);
// Initial state
const initialState = {
    customers: [],
    loading: false,
    error: null,
};
// Reducer function
function customerReducer(state, action) {
    switch (action.type) {
        case "FETCH_CUSTOMERS_REQUEST":
        case "SEARCH_CUSTOMERS_REQUEST":
            return Object.assign(Object.assign({}, state), { loading: true, error: null });
        case "FETCH_CUSTOMERS_SUCCESS":
        case "SEARCH_CUSTOMERS_SUCCESS":
            return Object.assign(Object.assign({}, state), { customers: action.payload, loading: false });
        case "FETCH_CUSTOMERS_FAILURE":
        case "SEARCH_CUSTOMERS_FAILURE":
            return Object.assign(Object.assign({}, state), { loading: false, error: action.payload });
        case "ADD_CUSTOMER":
            return Object.assign(Object.assign({}, state), { customers: [...state.customers, action.payload] });
        case "UPDATE_CUSTOMER":
            return Object.assign(Object.assign({}, state), { customers: state.customers.map((customer) => (customer.id === action.payload.id ? action.payload : customer)) });
        case "DELETE_CUSTOMER":
            return Object.assign(Object.assign({}, state), { customers: state.customers.filter((customer) => customer.id !== action.payload) });
        default:
            return state;
    }
}
// Provider component
function CustomerProvider({ children }) {
    const [state, dispatch] = (0, react_1.useReducer)(customerReducer, initialState);
    const { state: authState } = (0, AuthContext_1.useAuth)();
    // Fetch all customers
    const fetchCustomers = (0, react_1.useCallback)(async () => {
        if (!authState.token)
            return;
        dispatch({ type: "FETCH_CUSTOMERS_REQUEST" });
        try {
            const response = await fetch("/api/customers", {
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to fetch customers");
            }
            const data = await response.json();
            dispatch({ type: "FETCH_CUSTOMERS_SUCCESS", payload: data });
        }
        catch (error) {
            console.error("Error fetching customers:", error);
            dispatch({
                type: "FETCH_CUSTOMERS_FAILURE",
                payload: error instanceof Error ? error.message : "Failed to fetch customers",
            });
        }
    }, [authState.token]);
    // Search customers
    const searchCustomers = (0, react_1.useCallback)(async (query) => {
        if (!authState.token)
            return;
        dispatch({ type: "SEARCH_CUSTOMERS_REQUEST" });
        try {
            const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, {
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to search customers");
            }
            const data = await response.json();
            dispatch({ type: "SEARCH_CUSTOMERS_SUCCESS", payload: data });
        }
        catch (error) {
            console.error("Error searching customers:", error);
            dispatch({
                type: "SEARCH_CUSTOMERS_FAILURE",
                payload: error instanceof Error ? error.message : "Failed to search customers",
            });
        }
    }, [authState.token]);
    // Add customer
    const addCustomer = (0, react_1.useCallback)(async (customer) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch("/api/customers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify(customer),
            });
            if (!response.ok) {
                throw new Error("Failed to add customer");
            }
            const data = await response.json();
            dispatch({ type: "ADD_CUSTOMER", payload: data });
        }
        catch (error) {
            console.error("Error adding customer:", error);
            throw error;
        }
    }, [authState.token]);
    // Update customer
    const updateCustomer = (0, react_1.useCallback)(async (customer) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch(`/api/customers/${customer.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify(customer),
            });
            if (!response.ok) {
                throw new Error("Failed to update customer");
            }
            const data = await response.json();
            dispatch({ type: "UPDATE_CUSTOMER", payload: data });
        }
        catch (error) {
            console.error("Error updating customer:", error);
            throw error;
        }
    }, [authState.token]);
    // Delete customer
    const deleteCustomer = (0, react_1.useCallback)(async (id) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch(`/api/customers/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to delete customer");
            }
            dispatch({ type: "DELETE_CUSTOMER", payload: id });
        }
        catch (error) {
            console.error("Error deleting customer:", error);
            throw error;
        }
    }, [authState.token]);
    const value = {
        state,
        fetchCustomers,
        searchCustomers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
    };
    return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}
// Custom hook
function useCustomer() {
    const context = (0, react_1.useContext)(CustomerContext);
    if (context === undefined) {
        throw new Error("useCustomer must be used within a CustomerProvider");
    }
    return context;
}
