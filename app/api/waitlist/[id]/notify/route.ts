import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth-middleware"
import twilio from "twilio"

// Initialize Twilio client
const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null

// POST - Notify a customer that their table is ready
export const POST = withAuth(async (req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params

    // Check if wait list entry exists
    const waitListEntry = await prisma.waitList.findUnique({
      where: { id },
    })

    if (!waitListEntry) {
      return NextResponse.json({ error: "Wait list entry not found" }, { status: 404 })
    }

    // If no phone number, just mark as notified
    if (!waitListEntry.phoneNumber) {
      const updatedEntry = await prisma.waitList.update({
        where: { id },
        data: { notified: true },
      })

      return NextResponse.json(updatedEntry)
    }

    // Send SMS notification if Twilio is configured
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
      await twilioClient.messages.create({
        body: `Hello ${waitListEntry.customerName}, your table at our restaurant is now ready! Please check in with the host.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: waitListEntry.phoneNumber,
      })
    } else {
      console.warn("Twilio not configured, skipping SMS notification")
    }

    // Update wait list entry to mark as notified
    const updatedEntry = await prisma.waitList.update({
      where: { id },
      data: { notified: true },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user.sub,
        action: "NOTIFY",
        entity: "WAITLIST",
        entityId: id,
        details: {
          customerName: waitListEntry.customerName,
          phoneNumber: waitListEntry.phoneNumber,
        },
      },
    })

    return NextResponse.json(updatedEntry)
  } catch (error) {
    console.error("Error notifying customer:", error)
    return NextResponse.json({ error: "Failed to notify customer" }, { status: 500 })
  }
})
