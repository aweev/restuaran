"use strict";
// ====== ACCOUNTING ======
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCKET_ROOMS = exports.SOCKET_EVENT_GROUPS = exports.SOCKET_EVENTS = exports.ROLE_PERMISSIONS = void 0;
// Role-based permission mapping
exports.ROLE_PERMISSIONS = {
    admin: [
        "menu:view",
        "menu:create",
        "menu:edit",
        "menu:delete",
        "order:view",
        "order:create",
        "order:edit",
        "order:delete",
        "order:process",
        "table:view",
        "table:create",
        "table:edit",
        "table:delete",
        "table:assign",
        "user:view",
        "user:create",
        "user:edit",
        "user:delete",
        "report:view",
        "report:export",
        "inventory:view",
        "inventory:create",
        "inventory:edit",
        "inventory:delete",
        "reservation:view",
        "reservation:create",
        "reservation:edit",
        "reservation:delete",
        "settings:view",
        "settings:edit",
        "send_messages",
    ],
    manager: [
        "menu:view",
        "menu:create",
        "menu:edit",
        "order:view",
        "order:create",
        "order:edit",
        "order:process",
        "table:view",
        "table:create",
        "table:edit",
        "table:assign",
        "user:view",
        "user:create",
        "user:edit",
        "report:view",
        "report:export",
        "inventory:view",
        "inventory:create",
        "inventory:edit",
        "reservation:view",
        "reservation:create",
        "reservation:edit",
        "reservation:delete",
        "settings:view",
        "settings:edit",
        "send_messages",
    ],
    staff: [
        "menu:view",
        "order:view",
        "order:create",
        "order:edit",
        "table:view",
        "table:assign",
        "reservation:view",
        "reservation:create",
        "send_messages",
    ],
    kitchen: ["menu:view", "order:view", "order:process", "inventory:view", "send_messages"],
    waiter: [
        "menu:view",
        "order:view",
        "order:create",
        "order:edit",
        "table:view",
        "table:assign",
        "reservation:view",
        "send_messages",
    ],
    cashier: [
        "order:view",
        "order:edit",
        "order:delete",
        "table:view",
        "table:assign",
        "reservation:view",
        "send_messages",
    ],
    delivery: [
        "order:view",
        "order:edit",
        "order:delete",
        "table:view",
        "table:assign",
        "reservation:view",
        "send_messages",
    ],
};
// ====== SOCKET EVENT CONSTANTS ======
exports.SOCKET_EVENTS = {
    // Reservation events
    RESERVATION_NEW: "reservation_new",
    RESERVATION_UPDATE: "reservation_update",
    RESERVATION_DELETE: "reservation_delete",
    // Order events
    ORDER_NEW: "order_new",
    ORDER_UPDATE: "order_update",
    ORDER_DELETE: "order_delete",
    // Order item events
    ORDER_ITEM_ADD: "order_item_add",
    ORDER_ITEM_UPDATE: "order_item_update",
    ORDER_ITEM_DELETE: "order_item_delete",
    // Kitchen events
    KITCHEN_ORDER_UPDATE: "kitchen_order_update",
    KITCHEN_ITEM_UPDATE: "kitchen_item_update",
    // Table events
    TABLE_STATUS_UPDATE: "table_status_update",
    // Notification events
    NOTIFICATION: "notification",
    // Connection events
    CONNECT: "connect",
    DISCONNECT: "disconnect",
    CONNECT_ERROR: "connect_error",
    // Room events
    JOIN_ROOM: "join_room",
    LEAVE_ROOM: "leave_room",
};
// Group events by type
exports.SOCKET_EVENT_GROUPS = {
    RESERVATION: [
        exports.SOCKET_EVENTS.RESERVATION_NEW,
        exports.SOCKET_EVENTS.RESERVATION_UPDATE,
        exports.SOCKET_EVENTS.RESERVATION_DELETE,
    ],
    ORDER: [
        exports.SOCKET_EVENTS.ORDER_NEW,
        exports.SOCKET_EVENTS.ORDER_UPDATE,
        exports.SOCKET_EVENTS.ORDER_DELETE,
    ],
    ORDER_ITEM: [
        exports.SOCKET_EVENTS.ORDER_ITEM_ADD,
        exports.SOCKET_EVENTS.ORDER_ITEM_UPDATE,
        exports.SOCKET_EVENTS.ORDER_ITEM_DELETE,
    ],
    KITCHEN: [
        exports.SOCKET_EVENTS.KITCHEN_ORDER_UPDATE,
        exports.SOCKET_EVENTS.KITCHEN_ITEM_UPDATE,
    ],
    TABLE: [
        exports.SOCKET_EVENTS.TABLE_STATUS_UPDATE,
    ],
    NOTIFICATION: [
        exports.SOCKET_EVENTS.NOTIFICATION,
    ],
    CONNECTION: [
        exports.SOCKET_EVENTS.CONNECT,
        exports.SOCKET_EVENTS.DISCONNECT,
        exports.SOCKET_EVENTS.CONNECT_ERROR,
    ],
    ROOM: [
        exports.SOCKET_EVENTS.JOIN_ROOM,
        exports.SOCKET_EVENTS.LEAVE_ROOM,
    ],
};
// Socket rooms
exports.SOCKET_ROOMS = {
    ALL: "all",
    KITCHEN: "kitchen",
    SERVERS: "servers",
    RECEPTION: "reception",
    MANAGEMENT: "management",
    getTableRoom: (tableId) => `table:${tableId}`,
    getOrderRoom: (orderId) => `order:${orderId}`,
};
