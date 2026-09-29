"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
const httpServer = http_1.default.createServer(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});
function isValidRoom(roomName) {
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
function hasPermission(user, roomName) {
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
const internalEmitHandler = (req, res) => {
    const { secret, room, event, data } = req.body;
    if (secret !== process.env.INTERNAL_EMIT_SECRET) {
        return res.status(403).send('Forbidden: Invalid secret');
    }
    if (!event || !room || (typeof room === 'string' && room.trim() === '') || (Array.isArray(room) && room.length === 0)) {
        return res.status(400).send('Bad Request: Missing or invalid room or event');
    }
    if (Array.isArray(room)) {
        for (const r of room) {
            if (!isValidRoom(r)) {
                return res.status(400).send(`Bad Request: Invalid room name in array: ${r}`);
            }
        }
    }
    else if (typeof room === 'string' && !isValidRoom(room)) {
        return res.status(400).send(`Bad Request: Invalid room name: ${room}`);
    }
    if (!room || !event) {
        return res.status(400).send('Missing room or event');
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
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error:Token not provided or invalid format'));
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        if (!payload.sub || typeof payload.sub !== "string" || !payload.role || typeof payload.role !== "string") {
            console.error('Invalid token payload:', payload);
            return next(new Error('Invalid token payload structure'));
        }
        socket.data.user = payload;
        next();
    }
    catch (error) {
        let errorMessage = 'Invalid token';
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            errorMessage = 'Token expired';
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            errorMessage = `Invalid token signature: ${error.message}`;
        }
        console.error('Token verification error:', errorMessage, error);
        next(new Error(`Authentication error: ${errorMessage}`));
    }
});
// Connection handler
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.data.user.sub} with role ${socket.data.user.role}`);
    const userRole = socket.data.user.role;
    const userId = socket.data.user.sub;
    if (userRole === 'customer') {
        // Assuming customer JWT payload also has 'sub' for customer ID
        socket.join(`customer:${userId}`);
    }
    // Join rooms based on role
    if (userRole === 'admin' || userRole === 'manager') {
        socket.join('admin');
    }
    if (userRole === 'kitchen') {
        socket.join('kitchen');
    }
    if (userRole === 'server') {
        socket.join('server');
        socket.join(`server:${userId}`); // Join server-specific room
    }
    // Join custom room
    socket.on('join_room', (roomName) => {
        console.log(`User ${socket.data.user.sub} joining room: ${roomName}`);
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
    socket.on('leave_room', (roomName) => {
        console.log(`User ${userId} leaving room: ${roomName}`);
        socket.leave(roomName);
        socket.emit('left_room_successfully', { room: roomName });
    });
    // Order event handling
    socket.on('order_event', (event) => {
        console.log(`Order event received from ${userId}: ${event.type}`, event.data);
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
                socket.emit('event_error', { message: `Unknown order_event type: ${event.type}` });
        }
    });
    // Kitchen event handling
    socket.on('kitchen_event', (event) => {
        console.log(`Received kitchen_event from ${userId}: {event.type}`, event.data);
        if (socket.data.user.role !== 'kitchen' && socket.data.user.role !== 'admin') {
            console.warn(`User ${userId} (role: ${socket.data.user.role}) tried to send kitchen_event. Denied.`);
            socket.emit('event_error', { message: 'Permission denied to send kitchen_event' });
            return;
        }
        switch (event.type) {
            case 'order_ready':
                if (!event.data.serverId) { // serverId is crucial here
                    console.error('Missing serverId in order_ready event from kitchen user', userId, event.data);
                    socket.emit('event_error', { message: 'Missing serverId for order_ready event' });
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
                socket.emit('event_error', { message: `Unknown kitchen_event type: ${event.type}` });
        }
    });
    // Handle disconnect
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${userId} (role: ${userRole}). Reason: ${reason}`);
    });
});
// Start the server
const PORT = process.env.WS_PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
});
