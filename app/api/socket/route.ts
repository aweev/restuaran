import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
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
  })
}