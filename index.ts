import dotenv from 'dotenv';
dotenv.config();

import http from 'http'
import express, { Request, Response } from 'express'
import { ParsedQs } from 'qs'
import { Server } from 'socket.io'
import jwt, { JwtPayload as StandardJwtPayload }  from 'jsonwebtoken'

const app = express()
app.use(express.json());

const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

interface CustomJwtPayload extends StandardJwtPayload {
  sub: string; // 'sub' (subject) should be the user ID and be a string
  role: string;
}

interface InternalEmitRequestBody {
  secret: string;
  room: string | string[]; // Can be a single room or an array of rooms
  event: string;
  data: unknown; // The data can be of any type
}

declare module 'socket.io' {
  interface SocketData {
    user: CustomJwtPayload;
  }
}

function isValidRoom(roomName: string): boolean {
  if (typeof roomName !== 'string' || roomName.trim() === '') {
    console.warn(`Validation Error: Room name "${roomName}" is invalid (empty or not a string).`);
    return false;
  }
  if (!/^[a-zA-Z0-9-_:]+$/.test(roomName)) {
    console.warn(`Validation Error: Room name "${roomName}" contains invalid characters.`);
    return false;
  }
  if (roomName.length > 100) { 
    console.warn(`Validation Error: Room name "${roomName}" is too long.`);
    return false;
  }
  return true;
}

function hasPermission(user: CustomJwtPayload, roomName: string): boolean {
  if (!user || !user.role) {
    console.warn(`Permission Check Error: User or user.role is missing for attempting to join room "${roomName}".`);
    return false; 
  }
  if (user.role === 'customer' && (roomName === 'admin' || roomName === 'kitchen')) {
    console.log(`Permission Denied: Customer ${user.sub} cannot join room ${roomName}.`);
    return false;
  }
  return true; 
}

// NOTE: Express 5's `RequestHandler` type resolves to `void | Promise<void>`, which does not
// accept a handler that returns the `Response` object. So this handler is typed explicitly
// with the request/response generics it needs and declared `: void`, responding via `res`
// instead of `return res...`.
const internalEmitHandler = (
  req: Request<Record<string, string>, unknown, InternalEmitRequestBody, ParsedQs>,
  res: Response,
): void => {
  const { secret, room, event, data } = req.body;

  if (secret !== process.env.INTERNAL_EMIT_SECRET) {
    res.status(403).send('Forbidden: Invalid secret');
    return;
  }

  if (!event || !room || (typeof room === 'string' && room.trim() === '') || (Array.isArray(room) && room.length === 0)) {
    res.status(400).send('Bad Request: Missing or invalid room or event');
    return;
  }

  if (Array.isArray(room)) {
    for (const r of room) {
        if(!isValidRoom(r)) {
            res.status(400).send(`Bad Request: Invalid room name in array: ${r}`);
            return;
        }
    }

  } else if (typeof room === 'string' && !isValidRoom(room)) {
    res.status(400).send(`Bad Request: Invalid room name: ${room}`);
    return;
  }

  if (!room || !event) {
    res.status(400).send('Missing room or event');
    return;
  }

  console.log(`Internal emit to room(s) '${Array.isArray(room) ? room.join(', ') : room}', event '${event}', data:`, data);
  io.to(room).emit(event, data); // io.to() correctly handles string or string[]
  res.status(200).send('Event emitted');
};

app.post('/internal/emit', internalEmitHandler);
// Authentication middleware
io.use((socket, next) => {
  const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('JWT_SECRET is not defined!');
  return next(new Error('Authentication configuration error'));
}

  const token = socket.handshake.auth.token

  if (!token) {
    return next(new Error('Authentication error:Token not provided or invalid format'))
  }

  try {
    const payload = jwt.verify(token, secret) as CustomJwtPayload

    if (!payload.sub || typeof payload.sub !== "string" || !payload.role || typeof payload.role !== "string") {
      console.error('Invalid token payload:', payload)
      return next(new Error('Invalid token payload structure'))
    }
    socket.data.user = payload
    next()
  } catch (error) {
    let errorMessage = 'Invalid token'
    if (error instanceof jwt.TokenExpiredError) {
      errorMessage = 'Token expired'
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = `Invalid token signature: ${error.message}`;
    } 
    console.error('Token verification error:', errorMessage, error);
    next(new Error(`Authentication error: ${errorMessage}`))
  }
})

// Connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.data.user.sub} with role ${socket.data.user.role}`)

  const userRole = socket.data.user.role;
  const userId = socket.data.user.sub;

  if (userRole === 'customer') {
    // Assuming customer JWT payload also has 'sub' for customer ID
    socket.join(`customer:${userId}`);
}

  // Join rooms based on role
  if (userRole === 'admin' || userRole === 'manager') {
    socket.join('admin')
  }

  if (userRole === 'kitchen') {
    socket.join('kitchen')
  }

  if (userRole === 'server') {
    socket.join('server')
    socket.join(`server:${userId}`) // Join server-specific room
  }

  // Join custom room
  socket.on('join_room', (roomName: string) => {
    console.log(`User ${socket.data.user.sub} joining room: ${roomName}`)
    if (!isValidRoom(roomName)) {
      socket.emit('join_room_error', { room: roomName, message: `Invalid room format: ${roomName}` });
      return;
    }
    if (!hasPermission(socket.data.user, roomName)) {
      socket.emit('join_room_error', { room: roomName, message: `Permission denied for room: ${roomName}` });
      return;
    }
    console.log(`User ${userId} (role: ${userRole}) joining room: ${roomName}`);
    socket.join(roomName);
    socket.emit('joined_room_successfully', { room: roomName });
  });

  // Leave custom room
  socket.on('leave_room', (roomName: string) => {
    console.log(`User ${userId} leaving room: ${roomName}`)
    socket.leave(roomName)
    socket.emit('left_room_successfully', { room: roomName });
  })

  // Order event handling
  socket.on('order_event', (event: { type: string; data: { serverId?: string;
    orderId?: string, customerId?: string; [key: string]: string | number | boolean | undefined } }) => {
    console.log(`Order event received from ${userId}: ${event.type}`, event.data)

    switch (event.type) {
      case 'order_created':
        io.to('kitchen').emit('order_created', event.data);
        io.to('admin').emit('order_created', event.data);
        break;
      case 'order_updated':
        io.to('kitchen').emit('order_updated', event.data);
        io.to('admin').emit('order_updated', event.data);
        if (event.data.serverId) {
          io.to(`server:${event.data.serverId}`).emit('order_updated', event.data);
        }
        break;
      case 'order_cancelled':
        io.to('kitchen').emit('order_cancelled', event.data);
        io.to('admin').emit('order_cancelled', event.data);
        if (event.data.serverId) {
          io.to(`server:${event.data.serverId}`).emit('order_cancelled', event.data);
        }
        break;
      default:
        console.warn(`Received unknown order_event type: ${event.type} from user ${userId}`);
        socket.emit('event_error', { message: `Unknown order_event type: ${event.type}`});
    }
  });

 // Kitchen event handling
 socket.on('kitchen_event', (event: { type: string; data: { serverId: string, orderId: string, [key: string]: string | number | boolean | undefined } }) => {
  console.log(`Received kitchen_event from ${userId}: {event.type}`, event.data);

  if (socket.data.user.role !== 'kitchen' && socket.data.user.role !== 'admin') {
    console.warn(`User ${userId} (role: ${socket.data.user.role}) tried to send kitchen_event. Denied.`);
    socket.emit('event_error', { message: 'Permission denied to send kitchen_event'});
    return;
}

switch (event.type) {
  case 'order_ready':
    if (!event.data.serverId) { // serverId is crucial here
        console.error('Missing serverId in order_ready event from kitchen user', userId, event.data);
        socket.emit('event_error', { message: 'Missing serverId for order_ready event'});
        return;
    }
    io.to(`server:${event.data.serverId}`).emit('order_ready', event.data);
    io.to('admin').emit('order_ready_for_server', event.data);
    break;
  case 'order_preparing':
    io.to('admin').emit('order_preparing', event.data);
    if (event.data.serverId) {
      io.to(`server:${event.data.serverId}`).emit('order_preparing', event.data);
    }
    if (event.data.customerId) {
      io.to(`customer:${event.data.customerId}`).emit('order_preparing', event.data);
    }
    break;
  default:
    console.warn(`Received unknown kitchen_event type: ${event.type} from user ${userId}`);
    socket.emit('event_error', { message: `Unknown kitchen_event type: ${event.type}`});
}
});

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${userId} (role: ${userRole}). Reason: ${reason}`);
  });
});

// Start the server
const PORT = process.env.WS_PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`)
})
