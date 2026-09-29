"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMenu = exports.MenuProvider = void 0;
const react_1 = require("react");
const AuthContext_1 = require("./AuthContext");
// Initial state
const initialState = {
    categories: [
        { id: "all", label: "All", items: 0 },
        { id: "breakfast", label: "Breakfast", items: 0 },
        { id: "soups", label: "Soups", items: 0 },
        { id: "pasta", label: "Pasta", items: 0 },
        { id: "main", label: "Main Course", items: 0 },
        { id: "burgers", label: "Burgers", items: 0 },
        { id: "desserts", label: "Desserts", items: 0 },
        { id: "drinks", label: "Drinks", items: 0 },
        { id: "sides", label: "Sides", items: 0 },
    ],
    items: [],
    loading: false,
    error: null,
    selectedCategory: "all",
};
// Reducer
const menuReducer = (state, action) => {
    switch (action.type) {
        case "FETCH_MENU_START":
            return Object.assign(Object.assign({}, state), { loading: true, error: null });
        case "FETCH_MENU_SUCCESS": {
            const items = Array.isArray(action.payload) ? action.payload : [];
            // Recalculate category counts
            const categories = state.categories.map((category) => (Object.assign(Object.assign({}, category), { items: category.id === "all" ? items.length : items.filter((item) => item && item.category === category.id).length })));
            return Object.assign(Object.assign({}, state), { items,
                categories, loading: false });
        }
        case "FETCH_MENU_FAILURE":
            return Object.assign(Object.assign({}, state), { loading: false, error: action.payload });
        case "SET_SELECTED_CATEGORY":
            return Object.assign(Object.assign({}, state), { selectedCategory: action.payload });
        case "UPDATE_ITEM_AVAILABILITY":
            return Object.assign(Object.assign({}, state), { items: state.items.map((item) => item.id === action.payload.itemId ? Object.assign(Object.assign({}, item), { available: action.payload.available }) : item) });
        case "UPDATE_ITEM":
            return Object.assign(Object.assign({}, state), { items: state.items.map((item) => (item.id === action.payload.id ? action.payload : item)) });
        case "ADD_ITEM":
            return Object.assign(Object.assign({}, state), { items: [...state.items, action.payload], categories: state.categories.map((category) => (Object.assign(Object.assign({}, category), { items: category.id === "all"
                        ? state.items.length + 1
                        : category.id === action.payload.category
                            ? category.items + 1
                            : category.items }))) });
        case "DELETE_ITEM":
            const deletedItem = state.items.find((item) => item.id === action.payload);
            return Object.assign(Object.assign({}, state), { items: state.items.filter((item) => item.id !== action.payload), categories: state.categories.map((category) => (Object.assign(Object.assign({}, category), { items: category.id === "all"
                        ? state.items.length - 1
                        : deletedItem && category.id === deletedItem.category
                            ? category.items - 1
                            : category.items }))) });
        default:
            return state;
    }
};
const MenuContext = (0, react_1.createContext)(undefined);
// Provider component
const MenuProvider = ({ children }) => {
    const [state, dispatch] = (0, react_1.useReducer)(menuReducer, initialState);
    const { state: authState } = (0, AuthContext_1.useAuth)();
    // Fetch menu items when component mounts
    (0, react_1.useEffect)(() => {
        fetchMenu();
    }, [fetchMenu]);
    // Actions
    // NOTE: these must stay referentially stable. Consumers list them in useEffect
    // dependency arrays (e.g. app/dashboard/page.tsx), so an unmemoized function
    // here re-triggers their effects on every render -> infinite loop.
    const fetchMenu = (0, react_1.useCallback)(async () => {
        dispatch({ type: "FETCH_MENU_START" });
        try {
            const response = await fetch("/api/menu");
            if (!response.ok) {
                throw new Error("Failed to fetch menu items");
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("Received non-array data for menu items");
            }
            dispatch({
                type: "FETCH_MENU_SUCCESS",
                payload: data,
            });
        }
        catch (error) {
            dispatch({
                type: "FETCH_MENU_FAILURE",
                payload: error instanceof Error ? error.message : "Failed to fetch menu items",
            });
        }
    }, []);
    const setSelectedCategory = (0, react_1.useCallback)((category) => {
        dispatch({ type: "SET_SELECTED_CATEGORY", payload: category });
    }, []);
    const updateItemAvailability = async (itemId, available) => {
        try {
            const response = await fetch(`/api/menu/${itemId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({ available }),
            });
            if (!response.ok) {
                throw new Error("Failed to update item availability");
            }
            dispatch({
                type: "UPDATE_ITEM_AVAILABILITY",
                payload: { itemId, available },
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to update item availability");
        }
    };
    const updateItem = async (item) => {
        try {
            const response = await fetch(`/api/menu/${item.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify(item),
            });
            if (!response.ok) {
                throw new Error("Failed to update menu item");
            }
            const updatedItem = await response.json();
            dispatch({
                type: "UPDATE_ITEM",
                payload: updatedItem,
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to update menu item");
        }
    };
    const addItem = async (item) => {
        try {
            const response = await fetch("/api/menu", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify(item),
            });
            if (!response.ok) {
                throw new Error("Failed to add menu item");
            }
            const newItem = await response.json();
            dispatch({
                type: "ADD_ITEM",
                payload: newItem,
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to add menu item");
        }
    };
    const deleteItem = async (itemId) => {
        try {
            const response = await fetch(`/api/menu/${itemId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to delete menu item");
            }
            dispatch({
                type: "DELETE_ITEM",
                payload: itemId,
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to delete menu item");
        }
    };
    return (<MenuContext.Provider value={{
            state,
            fetchMenu,
            setSelectedCategory,
            updateItemAvailability,
            updateItem,
            addItem,
            deleteItem,
        }}>
      {children}
    </MenuContext.Provider>);
};
exports.MenuProvider = MenuProvider;
// Custom hook
const useMenu = () => {
    const context = (0, react_1.useContext)(MenuContext);
    if (context === undefined) {
        throw new Error("useMenu must be used within a MenuProvider");
    }
    return context;
};
exports.useMenu = useMenu;
