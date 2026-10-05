import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth-middleware"

export const GET = withAuth(async (_req: AuthenticatedRequest) => {
  try {
    // Check if user has permission to view venues (admin/manager)
    const user = _req.user
    if (!user || !["admin", "manager"].includes(user.role as string)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // For now, return mock venues since we don't have a venues table
    // In a real implementation, this would query a venues table
    const venues = [
      {
        id: "venue-1",
        name: "Maison Chili",
        orgId: "org-1",
        timezone: "America/New_York",
        currency: "USD",
        address: "123 Main St, New York, NY 10001",
        phone: "+1-212-555-0100",
        isActive: true,
      },
      {
        id: "venue-2",
        name: "Maison Chili - Downtown",
        orgId: "org-1",
        timezone: "America/New_York",
        currency: "USD",
        address: "456 Broadway, New York, NY 10003",
        phone: "+1-212-555-0200",
        isActive: true,
      },
    ]

    return NextResponse.json(venues)
  } catch (error) {
    console.error("[venues] fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch venues" }, { status: 500 })
  }
})