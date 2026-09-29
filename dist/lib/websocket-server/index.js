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
const httpServer = http_1.default.createServer(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});
// Authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        socket.data.user = payload;
        next();
    }
    catch (_a) {
        next(new Error('Invalid token'));
    }
});
// Connection handler
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.data.user.sub}`);
    const userRole = socket.data.user.role;
    // Join rooms based on role
    if (userRole === 'admin' || userRole === 'manager') {
        socket.join('admin');
    }
    if (userRole === 'kitchen') {
        socket.join('kitchen');
    }
    if (userRole === 'server') {
        socket.join('server');
        socket.join(`server:${socket.data.user.sub}`);
    }
    // Join custom room
    socket.on('join_room', (room) => {
        socket.join(room);
    });
    // Leave custom room
    socket.on('leave_room', (room) => {
        socket.leave(room);
    });
    // Order event handling
    socket.on('order_event', (event) => {
        if (event.type === 'order_created') {
            io.to('kitchen').emit('order_created', event);
            io.to('admin').emit('order_created', event);
        }
        else if (event.type === 'order_updated') {
            io.to('kitchen').emit('order_updated', event);
            io.to('admin').emit('order_updated', event);
            io.to(`server:${event.data.serverId}`).emit('order_updated', event);
        }
    });
    // Kitchen event handling
    socket.on('kitchen_event', (event) => {
        if (event.type === 'order_ready') {
            io.to(`server:${event.data.serverId}`).emit('order_ready', event);
        }
    });
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.data.user.sub}`);
    });
});
// Start the server
const PORT = process.env.WS_PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
});
