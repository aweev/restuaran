"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToRoom = exports.setSocketIO = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const socket_io_1 = require("socket.io");
let io = null;
const setSocketIO = (server) => {
    io = new socket_io_1.Server(server);
};
exports.setSocketIO = setSocketIO;
const emitToRoom = (room, event, data) => {
    if (io) {
        io.to(room).emit(event, data);
    }
};
exports.emitToRoom = emitToRoom;
async function GET() {
    return server_1.NextResponse.json({
        status: "available",
        url: process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001",
        supportedEvents: [
            "order_created",
            "order_updated",
            "order_cancelled",
            "payment_added",
            "order_ready",
            "order_preparing",
            "notification",
            "reservation:update",
            "reservation:delete",
        ],
    });
}
