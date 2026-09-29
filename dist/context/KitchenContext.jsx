"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useKitchen = exports.KitchenProvider = void 0;
const react_1 = require("react");
const useLocalStorage_1 = require("@/hooks/useLocalStorage");
// Initial state
const initialState = {
    soundEnabled: true,
    notificationSettings: {
        newOrder: true,
        orderUpdated: true,
        orderCancelled: true,
        orderExpedite: true,
    },
    staffAssignments: [],
    preparationTimes: {},
    loading: false,
    error: null,
};
// Reducer
const kitchenReducer = (state, action) => {
    switch (action.type) {
        case "TOGGLE_SOUND":
            return Object.assign(Object.assign({}, state), { soundEnabled: !state.soundEnabled });
        case "UPDATE_NOTIFICATION_SETTINGS":
            return Object.assign(Object.assign({}, state), { notificationSettings: Object.assign(Object.assign({}, state.notificationSettings), action.payload) });
        case "FETCH_STAFF_ASSIGNMENTS_START":
            return Object.assign(Object.assign({}, state), { loading: true, error: null });
        case "FETCH_STAFF_ASSIGNMENTS_SUCCESS":
            return Object.assign(Object.assign({}, state), { staffAssignments: action.payload, loading: false });
        case "FETCH_STAFF_ASSIGNMENTS_FAILURE":
            return Object.assign(Object.assign({}, state), { loading: false, error: action.payload });
        case "UPDATE_STAFF_ASSIGNMENT": {
            const existingIndex = state.staffAssignments.findIndex((assignment) => assignment.userId === action.payload.userId);
            if (existingIndex >= 0) {
                const updatedAssignments = [...state.staffAssignments];
                updatedAssignments[existingIndex] = action.payload;
                return Object.assign(Object.assign({}, state), { staffAssignments: updatedAssignments });
            }
            else {
                return Object.assign(Object.assign({}, state), { staffAssignments: [...state.staffAssignments, action.payload] });
            }
        }
        case "REMOVE_STAFF_ASSIGNMENT":
            return Object.assign(Object.assign({}, state), { staffAssignments: state.staffAssignments.filter((assignment) => assignment.userId !== action.payload) });
        case "FETCH_PREPARATION_TIMES_START":
            return Object.assign(Object.assign({}, state), { loading: true, error: null });
        case "FETCH_PREPARATION_TIMES_SUCCESS":
            return Object.assign(Object.assign({}, state), { preparationTimes: action.payload, loading: false });
        case "FETCH_PREPARATION_TIMES_FAILURE":
            return Object.assign(Object.assign({}, state), { loading: false, error: action.payload });
        case "UPDATE_PREPARATION_TIME":
            return Object.assign(Object.assign({}, state), { preparationTimes: Object.assign(Object.assign({}, state.preparationTimes), { [action.payload.menuItemId]: action.payload.time }) });
        default:
            return state;
    }
};
const KitchenContext = (0, react_1.createContext)(undefined);
// Provider component
const KitchenProvider = ({ children }) => {
    const [persistedSettings, setPersistedSettings] = (0, useLocalStorage_1.useLocalStorage)("kitchen_settings", {
        soundEnabled: true,
        notificationSettings: initialState.notificationSettings,
    });
    const [state, dispatch] = (0, react_1.useReducer)(kitchenReducer, Object.assign(Object.assign({}, initialState), { soundEnabled: persistedSettings.soundEnabled, notificationSettings: persistedSettings.notificationSettings }));
    // Save settings to localStorage when they change
    (0, react_1.useEffect)(() => {
        if (persistedSettings.soundEnabled !== state.soundEnabled ||
            JSON.stringify(persistedSettings.notificationSettings) !== JSON.stringify(state.notificationSettings)) {
            setPersistedSettings({
                soundEnabled: state.soundEnabled,
                notificationSettings: state.notificationSettings,
            });
        }
    }, [state.soundEnabled, state.notificationSettings, persistedSettings, setPersistedSettings]);
    // Actions
    const toggleSound = () => {
        dispatch({ type: "TOGGLE_SOUND" });
    };
    const updateNotificationSettings = (settings) => {
        dispatch({ type: "UPDATE_NOTIFICATION_SETTINGS", payload: settings });
    };
    const fetchStaffAssignments = (0, react_1.useCallback)(async () => {
        dispatch({ type: "FETCH_STAFF_ASSIGNMENTS_START" });
        try {
            const response = await fetch("/api/kitchen/staff-assignments");
            if (!response.ok) {
                throw new Error("Failed to fetch staff assignments");
            }
            const data = await response.json();
            dispatch({
                type: "FETCH_STAFF_ASSIGNMENTS_SUCCESS",
                payload: data,
            });
        }
        catch (error) {
            dispatch({
                type: "FETCH_STAFF_ASSIGNMENTS_FAILURE",
                payload: error instanceof Error ? error.message : "Failed to fetch staff assignments",
            });
        }
    }, []);
    const updateStaffAssignment = async (assignment) => {
        try {
            const response = await fetch("/api/kitchen/staff-assignments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(assignment),
            });
            if (!response.ok) {
                throw new Error("Failed to update staff assignment");
            }
            dispatch({
                type: "UPDATE_STAFF_ASSIGNMENT",
                payload: assignment,
            });
        }
        catch (error) {
            console.error("Error updating staff assignment:", error);
            throw error;
        }
    };
    const removeStaffAssignment = async (userId) => {
        try {
            const response = await fetch(`/api/kitchen/staff-assignments/${userId}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                throw new Error("Failed to remove staff assignment");
            }
            dispatch({
                type: "REMOVE_STAFF_ASSIGNMENT",
                payload: userId,
            });
        }
        catch (error) {
            console.error("Error removing staff assignment:", error);
            throw error;
        }
    };
    const fetchPreparationTimes = async () => {
        dispatch({ type: "FETCH_PREPARATION_TIMES_START" });
        try {
            const response = await fetch("/api/kitchen/preparation-times");
            if (!response.ok) {
                throw new Error("Failed to fetch preparation times");
            }
            const data = await response.json();
            dispatch({
                type: "FETCH_PREPARATION_TIMES_SUCCESS",
                payload: data,
            });
        }
        catch (error) {
            dispatch({
                type: "FETCH_PREPARATION_TIMES_FAILURE",
                payload: error instanceof Error ? error.message : "Failed to fetch preparation times",
            });
        }
    };
    const updatePreparationTime = async (menuItemId, time) => {
        try {
            const response = await fetch("/api/kitchen/preparation-times", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ menuItemId, time }),
            });
            if (!response.ok) {
                throw new Error("Failed to update preparation time");
            }
            dispatch({
                type: "UPDATE_PREPARATION_TIME",
                payload: { menuItemId, time },
            });
        }
        catch (error) {
            console.error("Error updating preparation time:", error);
            throw error;
        }
    };
    return (<KitchenContext.Provider value={{
            state,
            toggleSound,
            updateNotificationSettings,
            fetchStaffAssignments,
            updateStaffAssignment,
            removeStaffAssignment,
            fetchPreparationTimes,
            updatePreparationTime,
        }}>
      {children}
    </KitchenContext.Provider>);
};
exports.KitchenProvider = KitchenProvider;
// Custom hook
const useKitchen = () => {
    const context = (0, react_1.useContext)(KitchenContext);
    if (context === undefined) {
        throw new Error("useKitchen must be used within a KitchenProvider");
    }
    return context;
};
exports.useKitchen = useKitchen;
