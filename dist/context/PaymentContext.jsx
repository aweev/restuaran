"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePayment = exports.PaymentProvider = void 0;
const react_1 = require("react");
const AuthContext_1 = require("./AuthContext");
// Initial state
const initialState = {
    payments: [],
    activePayment: null,
    loading: false,
    error: null,
    discounts: [],
    appliedDiscountId: null,
    promoCode: null,
};
// Reducer
const paymentReducer = (state, action) => {
    switch (action.type) {
        case "FETCH_PAYMENTS_START":
            return Object.assign(Object.assign({}, state), { loading: true, error: null });
        case "FETCH_PAYMENTS_SUCCESS":
            return Object.assign(Object.assign({}, state), { payments: action.payload, loading: false });
        case "FETCH_PAYMENTS_FAILURE":
            return Object.assign(Object.assign({}, state), { loading: false, error: action.payload });
        case "SET_ACTIVE_PAYMENT":
            return Object.assign(Object.assign({}, state), { activePayment: action.payload });
        case "ADD_PAYMENT":
            return Object.assign(Object.assign({}, state), { payments: [...state.payments, action.payload] });
        case "FETCH_DISCOUNTS_START":
            return Object.assign(Object.assign({}, state), { loading: true, error: null });
        case "FETCH_DISCOUNTS_SUCCESS":
            return Object.assign(Object.assign({}, state), { discounts: action.payload, loading: false });
        case "FETCH_DISCOUNTS_FAILURE":
            return Object.assign(Object.assign({}, state), { loading: false, error: action.payload });
        case "APPLY_DISCOUNT":
            return Object.assign(Object.assign({}, state), { appliedDiscountId: action.payload });
        case "REMOVE_DISCOUNT":
            return Object.assign(Object.assign({}, state), { appliedDiscountId: null });
        case "SET_PROMO_CODE":
            return Object.assign(Object.assign({}, state), { promoCode: action.payload });
        default:
            return state;
    }
};
const PaymentContext = (0, react_1.createContext)(undefined);
// Provider component
const PaymentProvider = ({ children }) => {
    const [state, dispatch] = (0, react_1.useReducer)(paymentReducer, initialState);
    const { state: authState } = (0, AuthContext_1.useAuth)();
    // Fetch payments when component mounts and user is authenticated
    (0, react_1.useEffect)(() => {
        if (authState.isAuthenticated) {
            fetchDiscounts();
        }
    }, [authState.isAuthenticated]);
    // Actions
    const fetchPayments = async (orderId) => {
        dispatch({ type: "FETCH_PAYMENTS_START" });
        try {
            const url = orderId ? `/api/orders/${orderId}/payments` : "/api/payments";
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to fetch payments");
            }
            const data = await response.json();
            dispatch({
                type: "FETCH_PAYMENTS_SUCCESS",
                payload: data,
            });
        }
        catch (error) {
            dispatch({
                type: "FETCH_PAYMENTS_FAILURE",
                payload: error instanceof Error ? error.message : "Failed to fetch payments",
            });
        }
    };
    const setActivePayment = (payment) => {
        dispatch({ type: "SET_ACTIVE_PAYMENT", payload: payment });
    };
    const addPayment = async (payment) => {
        try {
            const response = await fetch(`/api/orders/${payment.orderId}/payments`, {
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
                payload: newPayment,
            });
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error.message : "Failed to add payment");
        }
    };
    const fetchDiscounts = async () => {
        dispatch({ type: "FETCH_DISCOUNTS_START" });
        try {
            const response = await fetch("/api/discounts", {
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to fetch discounts");
            }
            const data = await response.json();
            dispatch({
                type: "FETCH_DISCOUNTS_SUCCESS",
                payload: data,
            });
        }
        catch (error) {
            dispatch({
                type: "FETCH_DISCOUNTS_FAILURE",
                payload: error instanceof Error ? error.message : "Failed to fetch discounts",
            });
        }
    };
    const applyDiscount = (discountId) => {
        dispatch({ type: "APPLY_DISCOUNT", payload: discountId });
    };
    const removeDiscount = () => {
        dispatch({ type: "REMOVE_DISCOUNT" });
    };
    const setPromoCode = (code) => {
        dispatch({ type: "SET_PROMO_CODE", payload: code });
    };
    const validatePromoCode = async (code) => {
        try {
            const response = await fetch(`/api/discounts/promo/${code}`, {
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to validate promo code");
            }
            return await response.json();
        }
        catch (error) {
            console.error("Error validating promo code:", error);
            return {
                valid: false,
                message: "Error validating promo code",
            };
        }
    };
    return (<PaymentContext.Provider value={{
            state,
            fetchPayments,
            setActivePayment,
            addPayment,
            fetchDiscounts,
            applyDiscount,
            removeDiscount,
            setPromoCode,
            validatePromoCode,
        }}>
      {children}
    </PaymentContext.Provider>);
};
exports.PaymentProvider = PaymentProvider;
// Custom hook
const usePayment = () => {
    const context = (0, react_1.useContext)(PaymentContext);
    if (context === undefined) {
        throw new Error("usePayment must be used within a PaymentProvider");
    }
    return context;
};
exports.usePayment = usePayment;
