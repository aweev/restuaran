"use client"

import { io, type Socket } from "socket.io-client"
import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/context/AuthContext"

// Define a singleton socket instance
let socket: Socket | null = null

// Socket URL from environment
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"

export interface ReservationNewData {
  id: string;
  customerName: string;
  tableId: string;
  reservationTime: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown; 
}
export interface ReservationUpdateData {
  id: string;
  status: string;
  updatedAt: string;
  [key: string]: unknown; 
}
export interface ReservationDeleteData {
  id: string;
  [key: string]: unknown; 
}
export interface ReservationEvent {
  type: "reservation_new" | "reservation_update" | "reservation_delete"
  data: ReservationNewData | ReservationUpdateData | ReservationDeleteData
}
export interface OrderNewData {
  id: string;
  customerName: string;
  tableId: string;
  orderItems: Array<{ itemId: string; quantity: number }>
  totalAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
export interface OrderUpdateData {
  id: string;
  status: string;
  updatedAt: string;
  [key: string]: unknown;
}
export interface OrderDeleteData {
  id: string;
  [key: string]: unknown;
}
export interface OrderEvent {
  type: "order_new" | "order_update" | "order_delete"
  data: OrderNewData | OrderUpdateData | OrderDeleteData
}
export interface OrderItemUpdateData {
  id: string;
  itemId: string;
  quantity: number;
  status: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface OrderItemDeleteData {
  id: string;
  [key: string]: unknown;
}
export interface OrderItemDeleteEvent {
  type: "order_item_delete"
  data: OrderItemDeleteData
}
export interface OrderItemAddData {
  id: string;
  itemId: string;
  quantity: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
export interface OrderItemAddEvent {
  type: "order_item_add"
  data: OrderItemAddData
}
export interface OrderItemCancelData {
  id: string;
  itemId: string;
  status: string;
  updatedAt: string;
  [key: string]: unknown;
}
export interface OrderItemCancelEvent {
  type: "order_item_cancel"
  data: OrderItemCancelData
}
export type ReservationSocketEvent = ReservationEvent
export type OrderSocketEvent = OrderEvent | OrderItemEvent | OrderItemDeleteEvent | OrderItemAddEvent | OrderItemCancelEvent
export type OrderItemEvent = {
  type: "order_item_update" | "order_item_delete" | "order_item_add" | "order_item_cancel"
  orderId: string
  data: Record<string, unknown>
}

export type KitchenEvent = {
  type: "order_ready" | "order_preparing"
  orderId: string
  data: Record<string, unknown>
}

export type NotificationEvent = {
  type: "notification"
  message: string
  level: "info" | "warning" | "error" | "success"
  data?: Record<string, unknown>
}

export type SocketEvent = OrderEvent | KitchenEvent | NotificationEvent | ReservationEvent
export type SocketEventType = "order_event" | "kitchen_event" | "notification_event" | "reservation_event"
export type SocketEventData = OrderEvent | KitchenEvent | NotificationEvent | ReservationEvent
export type SocketEventHandler = (event: SocketEvent) => void

export type SocketEventHandlerMap = {
  order_event: SocketEventHandler[]
  kitchen_event: SocketEventHandler[]
  notification_event: SocketEventHandler[]
  reservation_event: SocketEventHandler[]
}

export type AppSocketEventData = 
  | OrderEvent
  | KitchenEvent
  | NotificationEvent
  | ReservationEvent
  | ReservationNewData
  | ReservationUpdateData
  | ReservationDeleteData
  | {[key: string]: unknown};

export const SOCKET_EVENTS = {
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
}
export const SOCKET_EVENT_TYPES = {
  RESERVATION: [
    SOCKET_EVENTS.RESERVATION_NEW,
    SOCKET_EVENTS.RESERVATION_UPDATE,
    SOCKET_EVENTS.RESERVATION_DELETE,
  ],
  ORDER: [
    SOCKET_EVENTS.ORDER_NEW,
    SOCKET_EVENTS.ORDER_UPDATE,
    SOCKET_EVENTS.ORDER_DELETE,
    SOCKET_EVENTS.ORDER_ITEM_UPDATE,
    SOCKET_EVENTS.ORDER_ITEM_DELETE,
    SOCKET_EVENTS.ORDER_ITEM_ADD,
    SOCKET_EVENTS.ORDER_ITEM_CANCEL,
  ],
  KITCHEN: [
    SOCKET_EVENTS.KITCHEN_ORDER_READY,
    SOCKET_EVENTS.KITCHEN_ORDER_PREPARING,
  ],
  NOTIFICATION: [SOCKET_EVENTS.NOTIFICATION],
  GENERAL: [
    SOCKET_EVENTS.CONNECT,
    SOCKET_EVENTS.DISCONNECT,
    SOCKET_EVENTS.CONNECT_ERROR,
    SOCKET_EVENTS.JOIN_ROOM,
    SOCKET_EVENTS.LEAVE_ROOM,
    SOCKET_EVENTS.EVENT_ERROR,
  ],
}
export const SOCKET_EVENT_HANDLERS: SocketEventHandlerMap = {
  order_event: [],
  kitchen_event: [],
  notification_event: [],
  reservation_event: [],
}
export const addSocketEventHandler = (eventType: SocketEventType, handler: SocketEventHandler) => {
  if (SOCKET_EVENT_HANDLERS[eventType]) {
    SOCKET_EVENT_HANDLERS[eventType].push(handler)
  } else {
    console.warn(`No handlers found for event type: ${eventType}`)
  }
}
export const removeSocketEventHandler = (eventType: SocketEventType, handler: SocketEventHandler) => {
  if (SOCKET_EVENT_HANDLERS[eventType]) {
    SOCKET_EVENT_HANDLERS[eventType] = SOCKET_EVENT_HANDLERS[eventType].filter((h) => h !== handler)
  } else {
    console.warn(`No handlers found for event type: ${eventType}`)
  }
}
export const emitSocketEvent = (eventType: SocketEventType, eventData: SocketEventData) => {
  if (socket) {
    socket.emit(eventType, eventData)
  } else {
    console.error("Socket is not initialized")
  }
}

export const initializeSocket = (token: string) => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.on("connect", () => {
      console.log("Socket connected")
    })

    socket.on("disconnect", () => {
      console.log("Socket disconnected")
    })

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err)
    })
  }

  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    console.log("Global socket disconnect called.")
  }
}

export const joinRoom = (room: string) => {
  if (socket) {
    socket.emit("join_room", room)
  }
}

export const leaveRoom = (room: string) => {
  if (socket) {
    socket.emit("leave_room", room)
  }
}

export const useSocketEvents = (eventTypes: string[]) => {
  const [events, setEvents] = useState<SocketEvent[]>([])

  useEffect(() => {
    if (!socket) return

    const handleEvent = (event: SocketEvent) => {
      if (eventTypes.includes(event.type)) {
        setEvents((prev) => [...prev, event])
      }
    }

    // Register listeners for each event type
    eventTypes.forEach((eventType) => {
      socket?.on(eventType, handleEvent)
    })

    return () => {
      // Clean up listeners
      eventTypes.forEach((eventType) => {
        socket?.off(eventType, handleEvent)
      })
    }
  }, [eventTypes])

  return events
}

export const emitOrderEvent = (event: OrderEvent) => {
  if (socket) {
    socket.emit("order_event", event)
  }
}

export const emitKitchenEvent = (event: KitchenEvent) => {
  if (socket) {
    socket.emit("kitchen_event", event)
  }
}

export function useSocket() {
  const { state: authState } = useAuth();
  const [isConnected, setIsConnected] = useState(socket?.connected || false);

  useEffect(() => {
    if (authState.accessToken && !socket) {
      console.log("Initializing socket with token...");
      socket = io(SOCKET_URL, {
        auth: {
          token: authState.accessToken,
        },
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on("connect", () => {
        console.log("Socket connected:", socket?.id);
        setIsConnected(true);
      });

      socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        setIsConnected(false);
      });

      socket.on("connect_error", (err) => {
        console.error("Socket connection error:", err.message, (err as { data?: unknown }).data);
        setIsConnected(false);
      });

      return () => {
        if (socket) {
          console.log("Cleaning up socket instance due to effect re-run or unmount.");
        }
      };
    } else if (!authState.accessToken && socket) {
      console.log("Auth token removed, disconnecting socket.");
      socket.disconnect();
      socket = null;
      setIsConnected(false);
    }
  }, [authState.accessToken]);

  const subscribe = useCallback(<T = AppSocketEventData>(event: string, callback: (data: T) => void) => {
    if (!socket) {
      console.warn("Socket not initialized. Cannot subscribe to event:", event);
      return () => {};
    }
    console.log(`Subscribing to ${event}`);
    socket.on(event, callback as (...args: unknown[]) => void);
    return () => {
      if (socket) {
        console.log(`Unsubscribing from ${event}`);
        socket.off(event, callback as (...args: unknown[]) => void);
      }
    };
  }, []);

  const emit = useCallback(<T = unknown>(event: string, data: T) => {
    if (socket?.connected) {
      socket.emit(event, data);
    } else {
      console.warn(`Socket not connected. Cannot emit event: ${event}`, data);
    }
  }, []);

  const joinRoom = useCallback((roomName: string) => {
    emit(SOCKET_EVENTS.JOIN_ROOM, roomName);
  }, [emit]);

  const leaveRoom = useCallback((roomName: string) => {
    emit(SOCKET_EVENTS.LEAVE_ROOM, roomName);
  }, [emit]);

  return { isConnected, subscribe, emit, joinRoom, leaveRoom };
}
