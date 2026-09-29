"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationProvider = ReservationProvider;
exports.useReservation = useReservation;
const react_1 = require("react");
const AuthContext_1 = require("./AuthContext");
const socket_client_1 = require("@/lib/socket-client");
// Create the context
const ReservationContext = (0, react_1.createContext)(undefined);
// Initial state
const initialState = {
    reservations: [],
    loading: false,
    error: null,
};
// Reducer function
function reservationReducer(state, action) {
    switch (action.type) {
        case "FETCH_RESERVATIONS_REQUEST":
            return Object.assign(Object.assign({}, state), { loading: true, error: null });
        case "FETCH_RESERVATIONS_SUCCESS":
            return Object.assign(Object.assign({}, state), { reservations: Array.isArray(action.payload) ? action.payload : [], loading: false });
        case "FETCH_RESERVATIONS_FAILURE":
            return Object.assign(Object.assign({}, state), { loading: false, error: action.payload });
        case "ADD_RESERVATION":
            return Object.assign(Object.assign({}, state), { reservations: [...state.reservations, action.payload] });
        case "UPDATE_RESERVATION":
            return Object.assign(Object.assign({}, state), { reservations: state.reservations.map((reservation) => reservation.id === action.payload.id ? action.payload : reservation) });
        case "CANCEL_RESERVATION":
            return Object.assign(Object.assign({}, state), { reservations: state.reservations.map((reservation) => reservation.id === action.payload
                    ? Object.assign(Object.assign({}, reservation), { status: "cancelled", updatedAt: new Date().toISOString() }) : reservation) });
        case "DELETE_RESERVATION":
            return Object.assign(Object.assign({}, state), { reservations: state.reservations.filter((reservation) => reservation.id !== action.payload) });
        default:
            return state;
    }
}
// Provider component
function ReservationProvider({ children }) {
    const [state, dispatch] = (0, react_1.useReducer)(reservationReducer, initialState);
    const { state: authState } = (0, AuthContext_1.useAuth)();
    const { subscribe } = (0, socket_client_1.useSocket)();
    // Set up WebSocket listeners
    (0, react_1.useEffect)(() => {
        if (!authState.isAuthenticated)
            return;
        // Subscribe to reservation events
        const unsubscribeNew = subscribe("reservation:new", (data) => {
            dispatch({ type: "ADD_RESERVATION", payload: data });
        });
        const unsubscribeUpdate = subscribe("reservation:update", (data) => {
            dispatch({ type: "UPDATE_RESERVATION", payload: data });
        });
        const unsubscribeDelete = subscribe("reservation:delete", (data) => {
            dispatch({ type: "DELETE_RESERVATION", payload: data.id });
        });
        return () => {
            unsubscribeNew();
            unsubscribeUpdate();
            unsubscribeDelete();
        };
    }, [authState.isAuthenticated, subscribe]);
    // Real API calls
    const fetchReservations = (0, react_1.useCallback)(async () => {
        if (!authState.token)
            return;
        dispatch({ type: "FETCH_RESERVATIONS_REQUEST" });
        try {
            const response = await fetch("/api/reservations", {
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to fetch reservations");
            }
            const data = await response.json();
            // Transform data if needed (snake_case to camelCase)
            const reservations = data.map((item) => ({
                id: item.id,
                customerName: item.customer_name,
                phone: item.phone,
                email: item.email,
                partySize: item.party_size,
                tableId: item.table_id,
                date: item.date,
                time: item.time,
                status: item.status,
                notes: item.notes,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
            }));
            dispatch({ type: "FETCH_RESERVATIONS_SUCCESS", payload: reservations });
        }
        catch (error) {
            console.error("Error fetching reservations:", error);
            dispatch({
                type: "FETCH_RESERVATIONS_FAILURE",
                payload: error instanceof Error ? error.message : "Failed to fetch reservations",
            });
        }
    }, [authState.token]);
    const addReservation = (0, react_1.useCallback)(async (reservation) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch("/api/reservations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    customerName: reservation.customerName,
                    phone: reservation.phone,
                    email: reservation.email,
                    partySize: reservation.partySize,
                    tableId: reservation.tableId,
                    date: reservation.date,
                    time: reservation.time,
                    status: reservation.status,
                    notes: reservation.notes,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to add reservation");
            }
            const data = await response.json();
            // Transform response if needed
            const newReservation = {
                id: data.id,
                customerName: data.customer_name,
                phone: data.phone,
                email: data.email,
                partySize: data.party_size,
                tableId: data.table_id,
                date: data.date,
                time: data.time,
                status: data.status,
                notes: data.notes,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };
            dispatch({ type: "ADD_RESERVATION", payload: newReservation });
        }
        catch (error) {
            console.error("Error adding reservation:", error);
            throw error;
        }
    }, [authState.token]);
    const updateReservation = (0, react_1.useCallback)(async (reservation) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch(`/api/reservations/${reservation.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    customerName: reservation.customerName,
                    phone: reservation.phone,
                    email: reservation.email,
                    partySize: reservation.partySize,
                    tableId: reservation.tableId,
                    date: reservation.date,
                    time: reservation.time,
                    status: reservation.status,
                    notes: reservation.notes,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to update reservation");
            }
            const data = await response.json();
            // Transform response if needed
            const updatedReservation = {
                id: data.id,
                customerName: data.customer_name,
                phone: data.phone,
                email: data.email,
                partySize: data.party_size,
                tableId: data.table_id,
                date: data.date,
                time: data.time,
                status: data.status,
                notes: data.notes,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };
            dispatch({ type: "UPDATE_RESERVATION", payload: updatedReservation });
        }
        catch (error) {
            console.error("Error updating reservation:", error);
            throw error;
        }
    }, [authState.token]);
    const cancelReservation = (0, react_1.useCallback)(async (id) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch(`/api/reservations/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    status: "cancelled",
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to cancel reservation");
            }
            dispatch({ type: "CANCEL_RESERVATION", payload: id });
        }
        catch (error) {
            console.error("Error cancelling reservation:", error);
            throw error;
        }
    }, [authState.token]);
    const deleteReservation = (0, react_1.useCallback)(async (id) => {
        if (!authState.token)
            return;
        try {
            const response = await fetch(`/api/reservations/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to delete reservation");
            }
            dispatch({ type: "DELETE_RESERVATION", payload: id });
        }
        catch (error) {
            console.error("Error deleting reservation:", error);
            throw error;
        }
    }, [authState.token]);
    const value = {
        state,
        fetchReservations,
        addReservation,
        updateReservation,
        cancelReservation,
        deleteReservation,
    };
    return <ReservationContext.Provider value={value}>{children}</ReservationContext.Provider>;
}
// Custom hook to use the context
function useReservation() {
    const context = (0, react_1.useContext)(ReservationContext);
    if (context === undefined) {
        throw new Error("useReservation must be used within a ReservationProvider");
    }
    return context;
}
