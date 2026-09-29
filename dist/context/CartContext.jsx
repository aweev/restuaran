"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCart = exports.CartProvider = void 0;
const react_1 = require("react");
// Initial state
const initialState = {
    items: [],
    tableId: null,
    customerName: null,
    diningMode: "Dine in",
    subtotal: 0,
    tax: 0,
    total: 0,
    discount: 0,
};
// Helper function to calculate item price with modifiers
const calculateItemTotalPrice = (basePrice, quantity, modifiers, menuItem) => {
    let modifierPrice = 0;
    modifiers.forEach((selection) => {
        var _a;
        const itemModifier = (_a = menuItem.modifiers) === null || _a === void 0 ? void 0 : _a.find((m) => m.id === selection.modifierId);
        if (itemModifier) {
            selection.optionIds.forEach((optionId) => {
                const option = itemModifier.options.find((o) => o.id === optionId);
                if (option) {
                    modifierPrice += option.price;
                }
            });
        }
    });
    return (basePrice + modifierPrice) * quantity;
};
// Helper function to recalculate cart totals
const recalculateCartTotals = (items, discount) => {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = 0.05; // 5% tax rate
    const tax = subtotal * taxRate;
    const total = subtotal + tax - discount;
    return { subtotal, tax, total };
};
// Reducer
const cartReducer = (state, action) => {
    switch (action.type) {
        case "ADD_ITEM": {
            const { menuItem, quantity, modifiers, specialInstructions } = action.payload;
            // Calculate total price including modifiers
            const totalPrice = calculateItemTotalPrice(menuItem.price, quantity, modifiers, menuItem);
            // Check if item with same modifiers already exists
            const existingItemIndex = state.items.findIndex((item) => {
                var _a;
                if (item.menuItemId !== menuItem.id)
                    return false;
                // Check if modifiers match
                if (((_a = item.modifiers) === null || _a === void 0 ? void 0 : _a.length) !== modifiers.length)
                    return false;
                // Deep comparison of modifiers
                const modifiersMatch = item.modifiers.every((itemMod) => {
                    const matchingMod = modifiers.find((m) => m.modifierId === itemMod.modifierId);
                    if (!matchingMod)
                        return false;
                    // Compare option IDs (order doesn't matter)
                    const itemOptions = [...itemMod.optionIds].sort();
                    const newOptions = [...matchingMod.optionIds].sort();
                    return itemOptions.length === newOptions.length && itemOptions.every((opt, i) => opt === newOptions[i]);
                });
                return modifiersMatch;
            });
            let updatedItems;
            if (existingItemIndex >= 0) {
                // Update existing item quantity
                updatedItems = state.items.map((item, index) => {
                    if (index === existingItemIndex) {
                        const newQuantity = item.quantity + quantity;
                        const newTotalPrice = calculateItemTotalPrice(menuItem.price, newQuantity, modifiers, menuItem);
                        return Object.assign(Object.assign({}, item), { quantity: newQuantity, totalPrice: newTotalPrice });
                    }
                    return item;
                });
            }
            else {
                // Add new item
                const newItem = {
                    id: Date.now().toString(),
                    menuItemId: menuItem.id,
                    title: menuItem.title,
                    price: menuItem.price,
                    quantity,
                    image: menuItem.image,
                    type: menuItem.type,
                    modifiers,
                    specialInstructions,
                    totalPrice,
                };
                updatedItems = [...state.items, newItem];
            }
            // Recalculate totals
            const { subtotal, tax, total } = recalculateCartTotals(updatedItems, state.discount);
            return Object.assign(Object.assign({}, state), { items: updatedItems, subtotal,
                tax,
                total });
        }
        case "REMOVE_ITEM": {
            const updatedItems = state.items.filter((item) => item.id !== action.payload);
            const { subtotal, tax, total } = recalculateCartTotals(updatedItems, state.discount);
            return Object.assign(Object.assign({}, state), { items: updatedItems, subtotal,
                tax,
                total });
        }
        case "UPDATE_QUANTITY": {
            const { id, quantity } = action.payload;
            if (quantity <= 0) {
                // If quantity is 0 or negative, remove the item
                return cartReducer(state, { type: "REMOVE_ITEM", payload: id });
            }
            const updatedItems = state.items.map((item) => {
                if (item.id === id) {
                    // Recalculate total price based on new quantity
                    const totalPrice = item.price * quantity + (item.totalPrice / item.quantity - item.price) * quantity;
                    return Object.assign(Object.assign({}, item), { quantity, totalPrice });
                }
                return item;
            });
            const { subtotal, tax, total } = recalculateCartTotals(updatedItems, state.discount);
            return Object.assign(Object.assign({}, state), { items: updatedItems, subtotal,
                tax,
                total });
        }
        case "CLEAR_CART":
            return Object.assign(Object.assign({}, initialState), { tableId: state.tableId, customerName: state.customerName, diningMode: state.diningMode });
        case "SET_TABLE":
            return Object.assign(Object.assign({}, state), { tableId: action.payload.tableId, customerName: action.payload.customerName || state.customerName });
        case "SET_DINING_MODE":
            return Object.assign(Object.assign({}, state), { diningMode: action.payload });
        case "APPLY_DISCOUNT": {
            const { amount, code } = action.payload;
            const total = state.subtotal + state.tax - amount;
            return Object.assign(Object.assign({}, state), { discount: amount, discountCode: code, total });
        }
        case "REMOVE_DISCOUNT": {
            const total = state.subtotal + state.tax;
            return Object.assign(Object.assign({}, state), { discount: 0, discountCode: undefined, total });
        }
        case "UPDATE_ITEM_MODIFIERS": {
            const { id, modifiers } = action.payload;
            const updatedItems = state.items.map((item) => {
                if (item.id === id) {
                    // Find the menu item to recalculate price
                    // In a real app, you'd probably need to fetch this from the MenuContext
                    // For now, we'll estimate by using the current price and quantity
                    const basePrice = item.price;
                    const quantity = item.quantity;
                    // This is a simplified calculation since we don't have the full menu item here
                    // In a real implementation, you'd want to pass the full menu item or use a context
                    const totalPrice = item.totalPrice; // This would need proper recalculation
                    return Object.assign(Object.assign({}, item), { modifiers, totalPrice });
                }
                return item;
            });
            const { subtotal, tax, total } = recalculateCartTotals(updatedItems, state.discount);
            return Object.assign(Object.assign({}, state), { items: updatedItems, subtotal,
                tax,
                total });
        }
        case "UPDATE_SPECIAL_INSTRUCTIONS": {
            const { id, instructions } = action.payload;
            const updatedItems = state.items.map((item) => {
                if (item.id === id) {
                    return Object.assign(Object.assign({}, item), { specialInstructions: instructions });
                }
                return item;
            });
            return Object.assign(Object.assign({}, state), { items: updatedItems });
        }
        default:
            return state;
    }
};
const CartContext = (0, react_1.createContext)(undefined);
// Provider component
const CartProvider = ({ children }) => {
    const [state, dispatch] = (0, react_1.useReducer)(cartReducer, initialState);
    // Load from localStorage on initial render
    (0, react_1.useEffect)(() => {
        const loadCartState = () => {
            try {
                const storedCart = localStorage.getItem("posCart");
                if (storedCart) {
                    const cartData = JSON.parse(storedCart);
                    // We need to manually dispatch each action to properly calculate totals
                    // First set the table and dining mode
                    if (cartData.tableId) {
                        dispatch({
                            type: 'SET_TABLE',
                            payload: {
                                tableId: cartData.tableId,
                                customerName: cartData.customerName
                            }
                        });
                    }
                    if (cartData.diningMode) {
                        dispatch({
                            type: "SET_DINING_MODE",
                            payload: cartData.diningMode,
                        });
                    }
                    // Then add each item
                    if (cartData.items && Array.isArray(cartData.items)) {
                        cartData.items.forEach((item) => {
                            // We need to reconstruct the menu item from the cart item
                            // In a real app, you'd probably fetch this from the MenuContext
                            const menuItem = {
                                id: item.menuItemId,
                                title: item.title,
                                description: "",
                                price: item.price,
                                image: item.image || "",
                                category: "all", // Default category
                                type: item.type,
                                available: true,
                            };
                            dispatch({
                                type: "ADD_ITEM",
                                payload: {
                                    menuItem,
                                    quantity: item.quantity,
                                    modifiers: item.modifiers || [],
                                    specialInstructions: item.specialInstructions,
                                },
                            });
                        });
                    }
                    // Apply discount if any
                    if (cartData.discount && cartData.discount > 0) {
                        dispatch({
                            type: "APPLY_DISCOUNT",
                            payload: {
                                amount: cartData.discount,
                                code: cartData.discountCode,
                            },
                        });
                    }
                }
            }
            catch (error) {
                console.error("Error loading cart state from localStorage", error);
            }
        };
        loadCartState();
    }, []);
    // Save to localStorage whenever state changes
    (0, react_1.useEffect)(() => {
        localStorage.setItem("posCart", JSON.stringify(state));
    }, [state]);
    // Actions
    const addItem = (menuItem, quantity, modifiers, specialInstructions) => {
        dispatch({
            type: "ADD_ITEM",
            payload: { menuItem, quantity, modifiers, specialInstructions },
        });
    };
    const removeItem = (id) => {
        dispatch({ type: "REMOVE_ITEM", payload: id });
    };
    const updateQuantity = (id, quantity) => {
        dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } });
    };
    const clearCart = () => {
        dispatch({ type: "CLEAR_CART" });
    };
    const setTable = (tableId, customerName) => {
        dispatch({ type: "SET_TABLE", payload: { tableId, customerName } });
    };
    const setDiningMode = (mode) => {
        dispatch({ type: "SET_DINING_MODE", payload: mode });
    };
    const applyDiscount = (amount, code) => {
        dispatch({ type: "APPLY_DISCOUNT", payload: { amount, code } });
    };
    const removeDiscount = () => {
        dispatch({ type: "REMOVE_DISCOUNT" });
    };
    const updateItemModifiers = (id, modifiers) => {
        dispatch({ type: "UPDATE_ITEM_MODIFIERS", payload: { id, modifiers } });
    };
    const updateSpecialInstructions = (id, instructions) => {
        dispatch({
            type: "UPDATE_SPECIAL_INSTRUCTIONS",
            payload: { id, instructions },
        });
    };
    return (<CartContext.Provider value={{
            state,
            addItem,
            removeItem,
            updateQuantity,
            clearCart,
            setTable,
            setDiningMode,
            applyDiscount,
            removeDiscount,
            updateItemModifiers,
            updateSpecialInstructions,
        }}>
      {children}
    </CartContext.Provider>);
};
exports.CartProvider = CartProvider;
// Custom hook
const useCart = () => {
    const context = (0, react_1.useContext)(CartContext);
    if (context === undefined) {
        throw new Error("useCart must be used within a CartProvider");
    }
    return context;
};
exports.useCart = useCart;
