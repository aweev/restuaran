//lib/socketEmitter.ts
import { NextResponse } from "next/server";

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
const INTERNAL_EMIT_SECRET = process.env.INTERNAL_EMIT_SECRET; 

interface EmitPayload {
  room: string | string[]; 
  event: string;
  data: unknown;
}

export const triggerSocketEvent = async (payload: EmitPayload) => {
  if (!INTERNAL_EMIT_SECRET) {
    console.error("INTERNAL_EMIT_SECRET is not configured. Cannot trigger socket event.");
    return { success: false, message: "Server configuration error for internal emit." };
  }
  if (!SOCKET_SERVER_URL) {
    console.error("NEXT_PUBLIC_SOCKET_URL is not configured. Cannot trigger socket event.");
    return { success: false, message: "Server configuration error for socket URL." };
  }

  try {
    const response = await fetch(`${SOCKET_SERVER_URL}/internal/emit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, secret: INTERNAL_EMIT_SECRET }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to trigger socket event: ${response.status} ${errorText}`);
      return { success: false, message: `Failed to trigger socket event: ${errorText}` };
    }
    console.log(`Successfully triggered socket event: ${payload.event} to room(s) ${payload.room}`);
    return { success: true, message: "Event triggered" };
  } catch (error) {
    console.error('Error triggering socket event:', error);
    return { success: false, message: `Error triggering socket event: ${error instanceof Error ? error.message : String(error)}` };
  }
};

// GET handler can remain for discovery
export async function GET() {
  return NextResponse.json({
    status: "available",
    url: SOCKET_SERVER_URL,
    info: "This endpoint is for Next.js API to trigger events on the standalone Socket.IO server.",
    supportedEventsBySocketServer: [
      "order_created",
      "order_updated",
      "order_cancelled",
      "payment_added", 
      "order_ready",
      "order_preparing",
      "low_stock_alert", 
      "table_status_update", 
      "new_reservation", 
      "waitlist_update", 
      "notification", 
    ],
  });
}
