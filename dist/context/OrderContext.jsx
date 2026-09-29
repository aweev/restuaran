"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useOrder = exports.OrderProvider = void 0;
const react_1 = require("react");
const AuthContext_1 = require("./AuthContext");
// Initial state
const initialState = {
    orders: [],
    activeOrders: [],
    completedOrders: [],
    loading: false,
    error: null,
    selectedOrder: null,
};
// Helper function to filter active and completed orders
const filterOrders = (orders) => {
    const activeStatuses = ["pending", "preparing", "ready", "delivered"];
    const completedStatuses = ["completed", "cancelled"];
    const activeOrders = orders.filter((order) => activeStatuses.includes(order.status));
    const completedOrders = orders.filter((order) => completedStatuses.includes(order.status));
    return { activeOrders, completedOrders };
};
// Reducer
const orderReducer = (state, action) => {
    var _a, _b, _c, _d, _e;
    switch (action.type) {
        case "FETCH_ORDERS_START":
            return Object.assign(Object.assign({}, state), { loading: true, error: null });
        case "FETCH_ORDERS_SUCCESS": {
            const orders = Array.isArray(action.payload) ? action.payload : [];
            const { activeOrders, completedOrders } = filterOrders(orders);
            return Object.assign(Object.assign({}, state), { orders,
                activeOrders,
                completedOrders, loading: false });
        }
        case "FETCH_ORDERS_FAILURE":
            return Object.assign(Object.assign({}, state), { loading: false, error: action.payload });
        case "SELECT_ORDER":
            return Object.assign(Object.assign({}, state), { selectedOrder: action.payload });
        case "CREATE_ORDER": {
            const newOrder = action.payload;
            const updatedOrders = [...state.orders, newOrder];
            const { activeOrders, completedOrders } = filterOrders(updatedOrders);
            return Object.assign(Object.assign({}, state), { orders: updatedOrders, activeOrders,
                completedOrders });
        }
        case "UPDATE_ORDER_STATUS": {
            const updatedOrders = state.orders.map((order) => order.id === action.payload.orderId
                ? Object.assign(Object.assign({}, order), { status: action.payload.status, updatedAt: new Date().toISOString() }) : order);
            const { activeOrders, completedOrders } = filterOrders(updatedOrders);
            return Object.assign(Object.assign({}, state), { orders: updatedOrders, activeOrders,
                completedOrders, 
                // Update selected order if it's the one being modified
                selectedOrder: ((_a = state.selectedOrder) === null || _a === void 0 ? void 0 : _a.id) === action.payload.orderId
                    ? Object.assign(Object.assign({}, state.selectedOrder), { status: action.payload.status, updatedAt: new Date().toISOString() }) : state.selectedOrder });
        }
        case "ADD_PAYMENT": {
            const { orderId, payment } = action.payload;
            const updatedOrders = state.orders.map((order) => {
                if (order.id === orderId) {
                    const updatedPayments = [...order.payments, payment];
                    const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
                    const isPaid = totalPaid >= order.total;
                    return Object.assign(Object.assign({}, order), { payments: updatedPayments, isPaid, updatedAt: new Date().toISOString() });
                }
                return order;
            });
            return Object.assign(Object.assign({}, state), { orders: updatedOrders, 
                // Update selected order if it's the one being modified
                selectedOrder: ((_b = state.selectedOrder) === null || _b === void 0 ? void 0 : _b.id) === orderId
                    ? Object.assign(Object.assign({}, state.selectedOrder), { payments: [...state.selectedOrder.payments, payment], isPaid: [...state.selectedOrder.payments, payment].reduce((sum, p) => sum + p.amount, 0) >=
                            state.selectedOrder.total, updatedAt: new Date().toISOString() }) : state.selectedOrder });
        }
        case "UPDATE_ORDER_ITEMS": {
            const { orderId, items } = action.payload;
            const updatedOrders = state.orders.map((order) => {
                if (order.id === orderId) {
                    // Recalculate totals
                    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
                    const taxRate = 0.05; // 5% tax rate
                    const tax = subtotal * taxRate;
                    const total = subtotal + tax - order.discount;
                    return Object.assign(Object.assign({}, order), { items,
                        subtotal,
                        tax,
                        total, updatedAt: new Date().toISOString() });
                }
                return order;
            });
            return Object.assign(Object.assign({}, state), { orders: updatedOrders, 
                // Update selected order if it's the one being modified
                selectedOrder: ((_c = state.selectedOrder) === null || _c === void 0 ? void 0 : _c.id) === orderId
                    ? Object.assign(Object.assign({}, state.selectedOrder), { items, subtotal: items.reduce((sum, item) => sum + item.totalPrice, 0), tax: items.reduce((sum, item) => sum + item.totalPrice, 0) * 0.05, total: items.reduce((sum, item) => sum + item.totalPrice, 0) * 1.05 - state.selectedOrder.discount, updatedAt: new Date().toISOString() }) : state.selectedOrder });
        }
        case "CANCEL_ORDER": {
            const updatedOrders = state.orders.map((order) => order.id === action.payload
                ? Object.assign(Object.assign({}, order), { status: "cancelled", updatedAt: new Date().toISOString() }) : order);
            const { activeOrders, completedOrders } = filterOrders(updatedOrders);
            return Object.assign(Object.assign({}, state), { orders: updatedOrders, activeOrders,
                completedOrders, 
                // Update selected order if it's the one being cancelled
                selectedOrder: ((_d = state.selectedOrder) === null || _d === void 0 ? void 0 : _d.id) === action.payload
                    ? Object.assign(Object.assign({}, state.selectedOrder), { status: "cancelled", updatedAt: new Date().toISOString() }) : state.selectedOrder });
        }
        case "UPDATE_ORDER_NOTES": {
            const { orderId, notes } = action.payload;
            const updatedOrders = state.orders.map((order) => order.id === orderId
                ? Object.assign(Object.assign({}, order), { notes, updatedAt: new Date().toISOString() }) : order);
            return Object.assign(Object.assign({}, state), { orders: updatedOrders, 
                // Update selected order if it's the one being modified
                selectedOrder: ((_e = state.selectedOrder) === null || _e === void 0 ? void 0 : _e.id) === orderId
                    ? Object.assign(Object.assign({}, state.selectedOrder), { notes, updatedAt: new Date().toISOString() }) : state.selectedOrder });
        }
        default:
            return state;
    }
};
const OrderContext = (0, react_1.createContext)(undefined);
// Provider component
const OrderProvider = ({ children }) => {
    const [state, dispatch] = (0, react_1.useReducer)(orderReducer, initialState);
    const { state: authState } = (0, AuthContext_1.useAuth)();
    // Fetch orders when component mounts and user is authenticated
    (0, react_1.useEffect)(() => {
        if (authState.isAuthenticated) {
            fetchOrders();
        }
    }, [authState.isAuthenticated]);
    // Actions
    const fetchOrders = (0, react_1.useCallback)(async () => {
        if (!authState.token) {
            return;
        }
        dispatch({ type: "FETCH_ORDERS_START" });
        try {
            const response = await fetch("/api/orders", {
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (response.status === 401) {
                dispatch({
                    type: "FETCH_ORDERS_FAILURE",
                    payload: "Authentication required",
                });
                return;
            }
            if (!response.ok) {
                throw new Error("Failed to fetch orders");
            }
            const data = await response.json();
            dispatch({
                type: "FETCH_ORDERS_SUCCESS",
                payload: data,
            });
        }
        catch (error) {
            dispatch({
                type: "FETCH_ORDERS_FAILURE",
                payload: error instanceof Error ? error.message : "Failed to fetch orders",
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authState.token]);
    const selectOrder = (order) => {
        dispatch({ type: "SELECT_ORDER", payload: order });
    };
    const createOrder = async (items, tableId, customerName, diningMode, serverId, subtotal, tax, discount, total, notes) => {
        try {
            const response = await fetch("/api/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    items,
                    tableId,
                    customerName,
                    diningMode,
                    serverId,
                    subtotal,
                    tax,
                    discount,
                    total,
                    notes,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to create order");
            }
            const newOrder = await response.json();
            dispatch({
                type: "CREATE_ORDER",
                payload: newOrder,
            });
            return newOrder;
        }
        catch (error) {
            throw error instanceof Error ? error : new Error("Failed to create order");
        }
    };
    const updateOrderStatus = async (orderId, status) => {
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({ status }),
            });
            if (!response.ok) {
                throw new Error("Failed to update order status");
            }
            dispatch({
                type: "UPDATE_ORDER_STATUS",
                payload: { orderId, status },
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to update order status");
        }
    };
    const addPayment = async (orderId, payment) => {
        try {
            const response = await fetch(`/api/orders/${orderId}/payments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify(payment),
            });
            if (!response.ok) {
                throw new Error("Failed to add payment");
            }
            const newPayment = await response.json();
            dispatch({
                type: "ADD_PAYMENT",
                payload: { orderId, payment: newPayment },
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to add payment");
        }
    };
    const updateOrderItems = async (orderId, items) => {
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({ items }),
            });
            if (!response.ok) {
                throw new Error("Failed to update order items");
            }
            dispatch({
                type: "UPDATE_ORDER_ITEMS",
                payload: { orderId, items },
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to update order items");
        }
    };
    const updateOrderNotes = async (orderId, notes) => {
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({ notes }),
            });
            if (!response.ok) {
                throw new Error("Failed to update order notes");
            }
            dispatch({
                type: "UPDATE_ORDER_NOTES",
                payload: { orderId, notes },
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to update order notes");
        }
    };
    const cancelOrder = async (orderId) => {
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({ status: "cancelled" }),
            });
            if (!response.ok) {
                throw new Error("Failed to cancel order");
            }
            dispatch({
                type: "CANCEL_ORDER",
                payload: orderId,
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to cancel order");
        }
    };
    return (<OrderContext.Provider value={{
            state,
            fetchOrders,
            selectOrder,
            createOrder,
            updateOrderStatus,
            addPayment,
            updateOrderItems,
            updateOrderNotes,
            cancelOrder,
        }}>
      {children}
    </OrderContext.Provider>);
};
exports.OrderProvider = OrderProvider;
// Custom hook
const useOrder = () => {
    const context = (0, react_1.useContext)(OrderContext);
    if (context === undefined) {
        throw new Error("useOrder must be used within an OrderProvider");
    }
    return context;
};
exports.useOrder = useOrder;
