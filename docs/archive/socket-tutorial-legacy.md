The `app/api/socket/route.ts` file in your Next.js app seems to be a bit of a mix-up.

- The `GET` handler is fine; it can act as a discovery endpoint for your frontend to know the socket server URL and supported events.
- The `setSocketIO` and `emitToRoom` functions using a local `io` instance _within a Next.js API route_ are generally problematic because API routes are often serverless functions and don't maintain a persistent WebSocket server instance easily. **You should be communicating from your Next.js API routes to your _standalone_ Socket.IO server (running on port 3001).**

Let's clarify how your Next.js API routes will interact with your standalone Socket.IO server:

1.  A client (browser, mobile app) makes an HTTP request to one of your Next.js API routes (e.g., `POST /api/orders`).
2.  The Next.js API route handles the request (e.g., saves the order to the database).
3.  **Crucially:** After successfully processing the request, the Next.js API route needs to tell your _standalone Socket.IO server_ to emit an event. This is usually done by having the Next.js API route make an internal HTTP request to a special, protected endpoint on your Socket.IO server, or by using a message queue (like Redis Pub/Sub) if you want to scale further.

**Let's implement the internal HTTP request method first for simplicity.**

**Step 1: Modify your Standalone Socket.IO Server (the first code block)**

Add a simple Express route to it that your Next.js API can call to trigger emissions.

```javascript
// ... (imports from your standalone server) ...
import dotenv from 'dotenv';
dotenv.config();

import http from 'http'
import express from 'express' // Make sure express is imported
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'

const app = express()
app.use(express.json()); // Middleware to parse JSON bodies for the new route

const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

// NEW: Internal API endpoint to trigger socket emissions
// Protect this with a secret!
app.post('/internal/emit', (req, res) => {
  const { secret, room, event, data } = req.body;

  if (secret !== process.env.INTERNAL_EMIT_SECRET) { // Add INTERNAL_EMIT_SECRET to your .env
    return res.status(403).send('Forbidden');
  }

  if (!room || !event) {
    return res.status(400).send('Missing room or event');
  }

  console.log(`Internal emit to room '${room}', event '${event}', data:`, data);
  io.to(room).emit(event, data);
  res.status(200).send('Event emitted');
});


// Authentication middleware
io.use((socket, next) => {
  // ... your existing auth middleware ...
  const token = socket.handshake.auth.token

  if (!token) {
    return next(new Error('Authentication error'))
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string)
    socket.data.user = payload
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

// Connection handler
io.on('connection', (socket) => {
  // ... your existing connection handler ...
  console.log(`User connected: ${socket.data.user.sub} with role ${socket.data.user.role}`)

  const userRole = socket.data.user.role

  // Join rooms based on role
  if (userRole === 'admin' || userRole === 'manager') {
    socket.join('admin')
  }

  if (userRole === 'kitchen') {
    socket.join('kitchen')
  }

  if (userRole === 'server') {
    socket.join('server') // General server room
    socket.join(`server:${socket.data.user.sub}`) // Specific server room
  }

  // Join custom room
  socket.on('join_room', (room: string) => {
    console.log(`User ${socket.data.user.sub} joining room: ${room}`)
    socket.join(room)
  })

  // Leave custom room
  socket.on('leave_room', (room: string) => {
    console.log(`User ${socket.data.user.sub} leaving room: ${room}`)
    socket.leave(room)
  })

  // Order event handling (these are typically emitted by clients, but also by server-side logic via /internal/emit)
  socket.on('order_event', (event: { type: string; data: { serverId?: string, orderId?: string, customerId?: string, [key: string]: any } }) => {
    console.log('Received order_event:', event);
    if (event.type === 'order_created') {
      io.to('kitchen').emit('order_created', event.data) // pass event.data
      io.to('admin').emit('order_created', event.data)
    } else if (event.type === 'order_updated') {
      io.to('kitchen').emit('order_updated', event.data)
      io.to('admin').emit('order_updated', event.data)
      if (event.data.serverId) {
        io.to(`server:${event.data.serverId}`).emit('order_updated', event.data)
      }
    } else if (event.type === 'order_cancelled') {
        io.to('kitchen').emit('order_cancelled', event.data);
        io.to('admin').emit('order_cancelled', event.data);
        if (event.data.serverId) {
          io.to(`server:${event.data.serverId}`).emit('order_cancelled', event.data);
        }
    }
  })

  // Kitchen event handling
  socket.on('kitchen_event', (event: { type: string; data: { serverId: string, orderId: string, [key: string]: any } }) => {
    console.log('Received kitchen_event:', event);
    if (event.type === 'order_ready') {
      io.to(`server:${event.data.serverId}`).emit('order_ready', event.data)
      io.to('admin').emit('order_ready_for_server', event.data) // Admin might want to know too
    } else if (event.type === 'order_preparing') {
      io.to('admin').emit('order_preparing', event.data)
      if(event.data.serverId){
          io.to(`server:${event.data.serverId}`).emit('order_preparing', event.data)
      }
      // Potentially notify customer if they have a real-time view
      // if (event.data.customerId) {
      //   io.to(`customer:${event.data.customerId}`).emit('order_preparing', event.data);
      // }
    }
  })


  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.data.user.sub}`)
  })
})

// Start the server
const PORT = process.env.WS_PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`)
})

// Add INTERNAL_EMIT_SECRET="your_strong_secret_here" to your .env file for the Socket.IO server
```

**Step 2: Modify `app/api/socket/route.ts` (or create a new helper file)**

This will now be a utility function to call your standalone server.

```typescript
// app/api/socket/route.ts OR a new file like lib/socketEmitter.ts
import { NextResponse } from "next/server";

const SOCKET_SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
const INTERNAL_EMIT_SECRET = process.env.INTERNAL_EMIT_SECRET; // Needs to be set in Next.js .env too

interface EmitPayload {
  room: string | string[]; // Socket.IO `to` can take a string or array of strings
  event: string;
  data: unknown;
}

export const triggerSocketEvent = async (payload: EmitPayload) => {
  if (!INTERNAL_EMIT_SECRET) {
    console.error(
      "INTERNAL_EMIT_SECRET is not configured. Cannot trigger socket event."
    );
    return {
      success: false,
      message: "Server configuration error for internal emit.",
    };
  }
  if (!SOCKET_SERVER_URL) {
    console.error(
      "NEXT_PUBLIC_SOCKET_URL is not configured. Cannot trigger socket event."
    );
    return {
      success: false,
      message: "Server configuration error for socket URL.",
    };
  }

  try {
    const response = await fetch(`${SOCKET_SERVER_URL}/internal/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...payload, secret: INTERNAL_EMIT_SECRET }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to trigger socket event: ${response.status} ${errorText}`
      );
      return {
        success: false,
        message: `Failed to trigger socket event: ${errorText}`,
      };
    }
    console.log(
      `Successfully triggered socket event: ${payload.event} to room(s) ${payload.room}`
    );
    return { success: true, message: "Event triggered" };
  } catch (error) {
    console.error("Error triggering socket event:", error);
    return {
      success: false,
      message: `Error triggering socket event: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};

// GET handler can remain for discovery
export async function GET() {
  return NextResponse.json({
    status: "available",
    url: SOCKET_SERVER_URL,
    info: "This endpoint is for Next.js API to trigger events on the standalone Socket.IO server.",
    // Your supportedEvents list is good, reflects what the Socket.IO server can broadcast
    supportedEventsBySocketServer: [
      "order_created",
      "order_updated",
      "order_cancelled",
      "payment_added", // Example, needs implementation
      "order_ready",
      "order_preparing",
      "low_stock_alert", // Example
      "table_status_update", // Example
      "new_reservation", // Example
      "waitlist_update", // Example
      "notification", // Generic notification
    ],
  });
}

// You might also want a POST handler here if you want clients
// to send events via HTTP to this Next.js API route, which then forwards
// them to the Socket.IO server. However, it's often cleaner for clients
// that *can* use WebSockets to connect directly to the Socket.IO server.
// This triggerSocketEvent is primarily for server-to-server (Next API -> Socket.IO server)
```

Ensure `INTERNAL_EMIT_SECRET` is also in your Next.js app's `.env.local` file.

---

**Where to Use Real-Time Features (Integrating `triggerSocketEvent`)**

Now, let's go through your API routes and identify where to call `triggerSocketEvent`.

**You don't need to share all your route code yet, but if you show me an example of how one of your API route handlers (e.g., `app/api/orders/route.ts` for POSTing a new order) is structured, I can give a more precise integration example.**

General areas:

1.  **`app/api/orders/route.ts` (and `[id]/route.ts`)**

    - **POST (Create Order):**

      - After successfully saving an order to the DB:

        ```typescript
        // In your POST /api/orders handler
        // const newOrder = await db.order.create(...);
        // const serverIdAssignedToOrder = newOrder.serverId; // or however you get this

        await triggerSocketEvent({
          room: ["kitchen", "admin"], // Emit to multiple rooms
          event: "order_created",
          data: {
            orderId: newOrder.id,
            /* other relevant order details */ items: newOrder.items,
            table: newOrder.tableNumber,
          },
        });
        ```

    - **PUT (Update Order - e.g., add item, change status by server/admin):**

      - After successfully updating an order in the DB:

        ```typescript
        // In your PUT /api/orders/[id] handler
        // const updatedOrder = await db.order.update(...);
        // const serverIdForThisOrder = updatedOrder.serverId;

        const roomsToNotify = ["kitchen", "admin"];
        if (serverIdForThisOrder) {
          roomsToNotify.push(`server:${serverIdForThisOrder}`);
        }
        await triggerSocketEvent({
          room: roomsToNotify,
          event: "order_updated",
          data: {
            orderId: updatedOrder.id,
            status: updatedOrder.status /* other changed details */,
          },
        });
        ```

    - **DELETE (Cancel Order):**

      - After successfully marking an order as cancelled:

        ```typescript
        // In your DELETE /api/orders/[id] handler
        // const cancelledOrder = await db.order.update({ where: { id }, data: { status: 'CANCELLED' } });
        // const serverIdForThisOrder = cancelledOrder.serverId;

        const roomsToNotify = ["kitchen", "admin"];
        if (serverIdForThisOrder) {
          roomsToNotify.push(`server:${serverIdForThisOrder}`);
        }
        await triggerSocketEvent({
          room: roomsToNotify,
          event: "order_cancelled",
          data: { orderId: cancelledOrder.id, reason: "..." },
        });
        ```

2.  **`app/api/orders/[id]/payments/route.ts`**

    - **POST (Add Payment):**
      - After successfully recording a payment:
        ```typescript
        // const orderId = params.id;
        // const payment = await db.payment.create(...);
        // const orderDetails = await db.order.findUnique({ where: {id: orderId }}); // To get serverId
        const roomsToNotify = ["admin"];
        if (orderDetails.serverId) {
          roomsToNotify.push(`server:${orderDetails.serverId}`);
        }
        await triggerSocketEvent({
          room: roomsToNotify,
          event: "payment_added",
          data: {
            orderId: orderId,
            paymentId: payment.id,
            amount: payment.amount,
          },
        });
        ```

3.  **`app/api/kitchen/*` (if these are for admin/manager to update things kitchen staff see)**

    - If `/api/kitchen/preparation-times/route.ts` is updated by an admin and kitchen staff need to see new estimated times live:
      ```typescript
      // After updating prep times
      await triggerSocketEvent({
        room: "kitchen", // Or specific kitchen staff if applicable
        event: "prep_time_config_updated",
        data: {
          /* new prep time configuration */
        },
      });
      ```
    - If `/api/kitchen/staff-assignments/route.ts` assigns tasks:
      ```typescript
      // After assigning staff
      await triggerSocketEvent({
        room: "kitchen", // Or a specific staff member's room if you create them
        event: "new_staff_assignment",
        data: {
          /* assignment details */
        },
      });
      ```
    - **Note:** Your current Socket.IO server handles `kitchen_event` like `order_ready` and `order_preparing`. These events would typically be emitted _by the kitchen client application_ directly to the Socket.IO server, not triggered by a Next.js API route (unless an admin is manually marking an order as ready via an admin panel, which would then go through a Next API route).
      - Example: Kitchen staff taps "Order Preparing" on their tablet. The tablet's client-side code does:
        `socket.emit('kitchen_event', { type: 'order_preparing', data: { orderId: '123', serverId: 'server_abc' } })`

4.  **`app/api/tables/[id]/route.ts` (Table Status Updates)**

    - When a table's status changes (e.g., occupied, dirty, available), likely modified by a server or host via their interface:
      ```typescript
      // In PUT /api/tables/[id]
      // const updatedTable = await db.table.update(...);
      await triggerSocketEvent({
        room: ["admin", "server"], // All servers and admins get table status updates
        event: "table_status_update",
        data: {
          tableId: updatedTable.id,
          status: updatedTable.status,
          serverIdInCharge: updatedTable.serverId,
        },
      });
      ```

5.  **`app/api/reservations/route.ts` (and `[id]/route.ts`)**

    - **POST (New Reservation):**
      ```typescript
      // const newReservation = await db.reservation.create(...);
      await triggerSocketEvent({
        room: "admin", // Or a 'host_stand' room
        event: "new_reservation",
        data: { reservationId: newReservation.id /* details */ },
      });
      ```
    - **PUT/DELETE (Update/Cancel Reservation):**
      ```typescript
      await triggerSocketEvent({
        room: 'admin', // Or 'host_stand'
        event: 'reservation_updated', // or 'reservation_cancelled'
        data: { reservationId: ..., /* details */ }
      });
      ```

6.  **`app/api/waitlist/route.ts` (and `[id]/route.ts`)**

    - **POST (Add to Waitlist):**
      ```typescript
      await triggerSocketEvent({
        room: 'admin', // Or 'host_stand'
        event: 'waitlist_updated',
        data: { action: 'added', entryId: ..., /* details */ }
      });
      ```
    - **`/notify/route.ts`, `/seat/route.ts`:**
      ```typescript
      await triggerSocketEvent({
        room: 'admin', // Or 'host_stand'
        event: 'waitlist_updated',
        data: { action: 'notified'/'seated', entryId: ..., /* details */ }
      });
      ```

7.  **`app/api/inventory/[id]/route.ts` (Low Stock Alerts)**

    - When an item's stock is updated and falls below a threshold:
      ```typescript
      // if (updatedItem.stock < updatedItem.lowStockThreshold) {
      await triggerSocketEvent({
        room: ["admin", "kitchen"],
        event: "low_stock_alert",
        data: {
          itemId: updatedItem.id,
          name: updatedItem.name,
          currentStock: updatedItem.stock,
        },
      });
      // }
      ```

8.  **`app/api/menu/[id]/route.ts` (Menu Item Availability - e.g., 86ing an item)**
    - When an admin/manager marks an item as unavailable:
      ```typescript
      // After updating menu item availability
      await triggerSocketEvent({
        room: ["admin", "server", "kitchen"], // Servers need to know, kitchen might too
        event: "menu_item_availability_changed",
        data: { itemId: menuItem.id, isAvailable: menuItem.isAvailable },
      });
      ```

**Customer-Facing Real-Time (Optional, but powerful):**

If you have customer-facing applications (e.g., a mobile app for customers to track their order, or a kiosk), you might want them to receive real-time updates too.
This would involve:

- Customers also connecting to the Socket.IO server.
- Customers joining a room specific to them (e.g., `customer:${customerId}`) or their order (`order:${orderId}`).
- Your API routes then also emitting events to these customer-specific rooms.

Example: `app/api/customer/orders/[id]/route.ts`
If a customer is viewing their order status, and the kitchen marks it as 'preparing':
The kitchen client emits `kitchen_event` with `type: 'order_preparing'`. Your Socket.IO server could then:

```javascript
// Inside kitchen_event handler on Socket.IO server
} else if (event.type === 'order_preparing') {
  io.to('admin').emit('order_preparing', event.data);
  if(event.data.serverId){
      io.to(`server:${event.data.serverId}`).emit('order_preparing', event.data);
  }
  // Assuming event.data contains customerId associated with the order
  if (event.data.customerId) {
    io.to(`customer:${event.data.customerId}`).emit('your_order_is_preparing', { orderId: event.data.orderId });
  }
}
```

This requires customers to join `customer:${customerId}` room upon connection if they are authenticated.

**Next Steps:**

1.  Implement the `/internal/emit` route on your standalone Socket.IO server.
2.  Implement the `triggerSocketEvent` utility in your Next.js app.
3.  Start integrating `triggerSocketEvent` calls into your Next.js API route handlers at the logical points after database operations.
4.  **Yes, please share an example of one of your API route handlers (e.g., the POST for `/api/orders/route.ts`).** This will allow me to give you a concrete example of where and how to place the `triggerSocketEvent` call.

This approach keeps your Next.js API routes focused on HTTP request handling and business logic, while your standalone Socket.IO server handles the real-time communication aspects.
