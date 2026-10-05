import { Server as HttpServer } from "http";
import { Server } from "socket.io";

/**
 * In-process Socket.IO registry.
 *
 * NOTE: this lives here rather than in `app/api/socket/route.ts` because a Next.js
 * route module may only export route handlers plus a handful of config values -- any
 * other export fails the generated route type check. See `md.md` for the broader note
 * that API routes should relay events to the standalone Socket.IO server on port 3001
 * rather than hosting one themselves.
 */
let io: Server | null = null;

export const setSocketIO = (server: HttpServer) => {
  io = new Server(server);
};

export const emitToRoom = (room: string, event: string, data: unknown) => {
  if (io) {
    io.to(room).emit(event, data);
  }
};
