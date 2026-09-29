"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitKitchenEvent = exports.emitOrderEvent = exports.useSocketEvents = exports.leaveRoom = exports.joinRoom = exports.disconnectSocket = exports.initializeSocket = exports.emitSocketEvent = exports.removeSocketEventHandler = exports.addSocketEventHandler = exports.SOCKET_EVENT_HANDLERS = exports.SOCKET_EVENT_TYPES = exports.SOCKET_EVENTS = void 0;
exports.useSocket = useSocket;
const socket_io_client_1 = require("socket.io-client");
const react_1 = require("react");
const AuthContext_1 = require("@/context/AuthContext");
// Define a singleton socket instance
let socket = null;
// Socket URL from environment
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
exports.SOCKET_EVENTS = {
    // Reservation specific events
    RESERVATION_NEW: "reservation_new",
    RESERVATION_UPDATE: "reservation_update",
    RESERVATION_DELETE: "reservation_delete",
    // Order specific events
    ORDER_NEW: "order_new",
    ORDER_UPDATE: "order_update",
    ORDER_DELETE: "order_delete",
    ORDER_ITEM_UPDATE: "order_item_update",
    ORDER_ITEM_DELETE: "order_item_delete",
    ORDER_ITEM_ADD: "order_item_add",
    ORDER_ITEM_CANCEL: "order_item_cancel",
    // Kitchen specific events
    KITCHEN_ORDER_READY: "order_ready",
    KITCHEN_ORDER_PREPARING: "order_preparing",
    // Notification events
    NOTIFICATION: "notification",
    // General events
    CONNECT: "connect",
    DISCONNECT: "disconnect",
    CONNECT_ERROR: "connect_error",
    JOIN_ROOM: "join_room",
    LEAVE_ROOM: "leave_room",
    EVENT_ERROR: "event_error",
};
exports.SOCKET_EVENT_TYPES = {
    RESERVATION: [
        exports.SOCKET_EVENTS.RESERVATION_NEW,
        exports.SOCKET_EVENTS.RESERVATION_UPDATE,
        exports.SOCKET_EVENTS.RESERVATION_DELETE,
    ],
    ORDER: [
        exports.SOCKET_EVENTS.ORDER_NEW,
        exports.SOCKET_EVENTS.ORDER_UPDATE,
        exports.SOCKET_EVENTS.ORDER_DELETE,
        exports.SOCKET_EVENTS.ORDER_ITEM_UPDATE,
        exports.SOCKET_EVENTS.ORDER_ITEM_DELETE,
        exports.SOCKET_EVENTS.ORDER_ITEM_ADD,
        exports.SOCKET_EVENTS.ORDER_ITEM_CANCEL,
    ],
    KITCHEN: [
        exports.SOCKET_EVENTS.KITCHEN_ORDER_READY,
        exports.SOCKET_EVENTS.KITCHEN_ORDER_PREPARING,
    ],
    NOTIFICATION: [exports.SOCKET_EVENTS.NOTIFICATION],
    GENERAL: [
        exports.SOCKET_EVENTS.CONNECT,
        exports.SOCKET_EVENTS.DISCONNECT,
        exports.SOCKET_EVENTS.CONNECT_ERROR,
        exports.SOCKET_EVENTS.JOIN_ROOM,
        exports.SOCKET_EVENTS.LEAVE_ROOM,
        exports.SOCKET_EVENTS.EVENT_ERROR,
    ],
};
exports.SOCKET_EVENT_HANDLERS = {
    order_event: [],
    kitchen_event: [],
    notification_event: [],
    reservation_event: [],
};
const addSocketEventHandler = (eventType, handler) => {
    if (exports.SOCKET_EVENT_HANDLERS[eventType]) {
        exports.SOCKET_EVENT_HANDLERS[eventType].push(handler);
    }
    else {
        console.warn(`No handlers found for event type: ${eventType}`);
    }
};
exports.addSocketEventHandler = addSocketEventHandler;
const removeSocketEventHandler = (eventType, handler) => {
    if (exports.SOCKET_EVENT_HANDLERS[eventType]) {
        exports.SOCKET_EVENT_HANDLERS[eventType] = exports.SOCKET_EVENT_HANDLERS[eventType].filter((h) => h !== handler);
    }
    else {
        console.warn(`No handlers found for event type: ${eventType}`);
    }
};
exports.removeSocketEventHandler = removeSocketEventHandler;
const emitSocketEvent = (eventType, eventData) => {
    if (socket) {
        socket.emit(eventType, eventData);
    }
    else {
        console.error("Socket is not initialized");
    }
};
exports.emitSocketEvent = emitSocketEvent;
const initializeSocket = (token) => {
    if (!socket) {
        socket = (0, socket_io_client_1.io)(SOCKET_URL, {
            auth: {
                token,
            },
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });
        socket.on("connect", () => {
            console.log("Socket connected");
        });
        socket.on("disconnect", () => {
            console.log("Socket disconnected");
        });
        socket.on("connect_error", (err) => {
            console.error("Socket connection error:", err);
        });
    }
    return socket;
};
exports.initializeSocket = initializeSocket;
const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        console.log("Global socket disconnect called.");
    }
};
exports.disconnectSocket = disconnectSocket;
const joinRoom = (room) => {
    if (socket) {
        socket.emit("join_room", room);
    }
};
exports.joinRoom = joinRoom;
const leaveRoom = (room) => {
    if (socket) {
        socket.emit("leave_room", room);
    }
};
exports.leaveRoom = leaveRoom;
const useSocketEvents = (eventTypes) => {
    const [events, setEvents] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        if (!socket)
            return;
        const handleEvent = (event) => {
            if (eventTypes.includes(event.type)) {
                setEvents((prev) => [...prev, event]);
            }
        };
        // Register listeners for each event type
        eventTypes.forEach((eventType) => {
            socket === null || socket === void 0 ? void 0 : socket.on(eventType, handleEvent);
        });
        return () => {
            // Clean up listeners
            eventTypes.forEach((eventType) => {
                socket === null || socket === void 0 ? void 0 : socket.off(eventType, handleEvent);
            });
        };
    }, [eventTypes]);
    return events;
};
exports.useSocketEvents = useSocketEvents;
const emitOrderEvent = (event) => {
    if (socket) {
        socket.emit("order_event", event);
    }
};
exports.emitOrderEvent = emitOrderEvent;
const emitKitchenEvent = (event) => {
    if (socket) {
        socket.emit("kitchen_event", event);
    }
};
exports.emitKitchenEvent = emitKitchenEvent;
function useSocket() {
    const { state: authState } = (0, AuthContext_1.useAuth)();
    const [isConnected, setIsConnected] = (0, react_1.useState)((socket === null || socket === void 0 ? void 0 : socket.connected) || false);
    (0, react_1.useEffect)(() => {
        if (authState.token && !socket) {
            console.log("Initializing socket with token...");
            socket = (0, socket_io_client_1.io)(SOCKET_URL, {
                auth: {
                    token: authState.token,
                },
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });
            socket.on("connect", () => {
                console.log("Socket connected:", socket === null || socket === void 0 ? void 0 : socket.id);
                setIsConnected(true);
            });
            socket.on("disconnect", (reason) => {
                console.log("Socket disconnected:", reason);
                setIsConnected(false);
            });
            socket.on("connect_error", (err) => {
                console.error("Socket connection error:", err.message, err.data);
                setIsConnected(false);
            });
            return () => {
                if (socket) {
                    console.log("Cleaning up socket instance due to effect re-run or unmount.");
                }
            };
        }
        else if (!authState.token && socket) {
            console.log("Auth token removed, disconnecting socket.");
            socket.disconnect();
            socket = null;
            setIsConnected(false);
        }
    }, [authState.token]);
    const subscribe = (0, react_1.useCallback)((event, callback) => {
        if (!socket) {
            console.warn("Socket not initialized. Cannot subscribe to event:", event);
            return () => { };
        }
        console.log(`Subscribing to ${event}`);
        socket.on(event, callback);
        return () => {
            if (socket) {
                console.log(`Unsubscribing from ${event}`);
                socket.off(event, callback);
            }
        };
    }, []);
    const emit = (0, react_1.useCallback)((event, data) => {
        if (socket === null || socket === void 0 ? void 0 : socket.connected) {
            socket.emit(event, data);
        }
        else {
            console.warn(`Socket not connected. Cannot emit event: ${event}`, data);
        }
    }, []);
    const joinRoom = (0, react_1.useCallback)((roomName) => {
        emit(exports.SOCKET_EVENTS.JOIN_ROOM, roomName);
    }, [emit]);
    const leaveRoom = (0, react_1.useCallback)((roomName) => {
        emit(exports.SOCKET_EVENTS.LEAVE_ROOM, roomName);
    }, [emit]);
    return { isConnected, subscribe, emit, joinRoom, leaveRoom };
}
