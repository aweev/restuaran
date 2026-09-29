"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryProvider = InventoryProvider;
exports.useInventory = useInventory;
const react_1 = require("react");
const AuthContext_1 = require("./AuthContext");
// Create the context
const InventoryContext = (0, react_1.createContext)(undefined);
// Initial state
const initialState = {
    ingredients: [],
    loading: false,
    error: null,
};
// Reducer function
function inventoryReducer(state, action) {
    switch (action.type) {
        case "FETCH_INVENTORY_REQUEST":
            return Object.assign(Object.assign({}, state), { loading: true, error: null });
        case "FETCH_INVENTORY_SUCCESS":
            return Object.assign(Object.assign({}, state), { ingredients: Array.isArray(action.payload) ? action.payload : [], loading: false });
        case "FETCH_INVENTORY_FAILURE":
            return Object.assign(Object.assign({}, state), { loading: false, error: action.payload });
        case "ADD_INGREDIENT":
            return Object.assign(Object.assign({}, state), { ingredients: [...state.ingredients, action.payload] });
        case "UPDATE_INGREDIENT":
            return Object.assign(Object.assign({}, state), { ingredients: state.ingredients.map((ingredient) => ingredient.id === action.payload.id ? action.payload : ingredient) });
        case "UPDATE_INGREDIENT_STOCK":
            return Object.assign(Object.assign({}, state), { ingredients: state.ingredients.map((ingredient) => ingredient.id === action.payload.id
                    ? Object.assign(Object.assign({}, ingredient), { currentStock: ingredient.currentStock + action.payload.quantity, lastUpdated: new Date().toISOString() }) : ingredient) });
        case "DELETE_INGREDIENT":
            return Object.assign(Object.assign({}, state), { ingredients: state.ingredients.filter((ingredient) => ingredient.id !== action.payload) });
        default:
            return state;
    }
}
// Provider component
function InventoryProvider({ children }) {
    const [state, dispatch] = (0, react_1.useReducer)(inventoryReducer, initialState);
    const { state: authState } = (0, AuthContext_1.useAuth)();
    // Real API calls
    const fetchInventory = (0, react_1.useCallback)(async () => {
        if (!authState.token)
            return;
        dispatch({ type: "FETCH_INVENTORY_REQUEST" });
        try {
            const response = await fetch("/api/inventory", {
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to fetch inventory");
            }
            const data = await response.json();
            // Transform data if needed (snake_case to camelCase)
            const ingredients = data.map((item) => ({
                id: item.id,
                name: item.name,
                category: item.category,
                unit: item.unit,
                currentStock: item.current_stock,
                reorderLevel: item.reorder_level,
                unitCost: item.unit_cost,
                usageLastMonth: item.usage_last_month,
                isActive: item.is_active,
                lastUpdated: item.updated_at,
            }));
            dispatch({ type: "FETCH_INVENTORY_SUCCESS", payload: ingredients });
        }
        catch (error) {
            console.error("Error fetching inventory:", error);
            dispatch({
                type: "FETCH_INVENTORY_FAILURE",
                payload: error instanceof Error ? error.message : "Failed to fetch inventory",
            });
        }
    }, [authState.token]);
    const addIngredient = (0, react_1.useCallback)(async (ingredient) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch("/api/inventory", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    name: ingredient.name,
                    category: ingredient.category,
                    unit: ingredient.unit,
                    currentStock: ingredient.currentStock,
                    reorderLevel: ingredient.reorderLevel,
                    unitCost: ingredient.unitCost,
                    isActive: ingredient.isActive,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to add ingredient");
            }
            const data = await response.json();
            // Transform response if needed
            const newIngredient = {
                id: data.id,
                name: data.name,
                category: data.category,
                unit: data.unit,
                currentStock: data.current_stock,
                reorderLevel: data.reorder_level,
                unitCost: data.unit_cost,
                usageLastMonth: data.usage_last_month || 0,
                isActive: data.is_active,
                lastUpdated: data.updated_at,
            };
            dispatch({ type: "ADD_INGREDIENT", payload: newIngredient });
        }
        catch (error) {
            console.error("Error adding ingredient:", error);
            throw error;
        }
    }, [authState.token]);
    const updateIngredient = (0, react_1.useCallback)(async (ingredient) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch(`/api/inventory/${ingredient.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    name: ingredient.name,
                    category: ingredient.category,
                    unit: ingredient.unit,
                    currentStock: ingredient.currentStock,
                    reorderLevel: ingredient.reorderLevel,
                    unitCost: ingredient.unitCost,
                    isActive: ingredient.isActive,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to update ingredient");
            }
            const data = await response.json();
            // Transform response if needed
            const updatedIngredient = {
                id: data.id,
                name: data.name,
                category: data.category,
                unit: data.unit,
                currentStock: data.current_stock,
                reorderLevel: data.reorder_level,
                unitCost: data.unit_cost,
                usageLastMonth: data.usage_last_month || ingredient.usageLastMonth || 0,
                isActive: data.is_active,
                lastUpdated: data.updated_at,
            };
            dispatch({ type: "UPDATE_INGREDIENT", payload: updatedIngredient });
        }
        catch (error) {
            console.error("Error updating ingredient:", error);
            throw error;
        }
    }, [authState.token]);
    const updateIngredientStock = (0, react_1.useCallback)(async (id, quantity) => {
        if (!authState.token)
            return;
        try {
            // Get current ingredient to calculate new stock
            const ingredient = state.ingredients.find((i) => i.id === id);
            if (!ingredient)
                throw new Error("Ingredient not found");
            const newStock = ingredient.currentStock + quantity;
            const response = await fetch(`/api/inventory/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    currentStock: newStock,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to update ingredient stock");
            }
            dispatch({ type: "UPDATE_INGREDIENT_STOCK", payload: { id, quantity } });
        }
        catch (error) {
            console.error("Error updating ingredient stock:", error);
            throw error;
        }
    }, [authState.token, state.ingredients]);
    const deleteIngredient = (0, react_1.useCallback)(async (id) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch(`/api/inventory/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to delete ingredient");
            }
            dispatch({ type: "DELETE_INGREDIENT", payload: id });
        }
        catch (error) {
            console.error("Error deleting ingredient:", error);
            throw error;
        }
    }, [authState.token]);
    const value = {
        state,
        fetchInventory,
        addIngredient,
        updateIngredient,
        updateIngredientStock,
        deleteIngredient,
    };
    return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}
// Custom hook to use the context
function useInventory() {
    const context = (0, react_1.useContext)(InventoryContext);
    if (context === undefined) {
        throw new Error("useInventory must be used within an InventoryProvider");
    }
    return context;
}
