import { NextResponse } from "next/server"
import { withAuth, type AuthenticatedRequest, type RouteContext } from "@/middleware/auth-middleware"
import { one, sqlWrite, audit } from "@/lib/db-helpers"
import twilio from "twilio"

/**
 * Initialised lazily so importing this route never throws at build time when
 * Twilio is unconfigured. The previous module-level `twilio(...)` call ran on
 * import, which would have crashed page-data collection in every environment
 * missing credentials.
 */
let client: ReturnType<typeof twilio> | null | undefined
function getTwilio(): ReturnType<typeof twilio> | null {
  if (client !== undefined) return client
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  client = sid && token ? twilio(sid, token) : null
  return client
}

type Ctx = RouteContext<{ id: string }>

export const POST = withAuth(async (req: AuthenticatedRequest, { params }: Ctx) => {
  try {
    const { id } = await params

    const entry = await one<{ id: string; customerName: string; phoneNumber: string | null }>(
      `SELECT id, "customerName", "phoneNumber" FROM "WaitlistEntry" WHERE id = $1`,
      [id],
    )
    if (!entry) return NextResponse.json({ error: "Wait list entry not found" }, { status: 404 })

    let sms: "sent" | "skipped" | "failed" = "skipped"

    if (entry.phoneNumber) {
      const twilioClient = getTwilio()
      const from = process.env.TWILIO_PHONE_NUMBER
      if (twilioClient && from) {
        try {
          await twilioClient.messages.create({
            body: `Hi ${entry.customerName} — your table at Maison Chili is ready. Please check in with the host.`,
            from,
            to: entry.phoneNumber,
          })
          sms = "sent"
        } catch (err) {
          // A failed SMS must not block the host from marking the guest notified.
          console.error("[waitlist] SMS failed:", err)
          sms = "failed"
        }
      }
    }

    const rows = await sqlWrite(
      `UPDATE "WaitlistEntry" SET notified = TRUE WHERE id = $1 RETURNING *`,
      [id],
    )

    await audit({
      userId: req.user.sub,
      action: "NOTIFY",
      entity: "WAITLIST",
      entityId: id,
      details: { customerName: entry.customerName, phoneNumber: entry.phoneNumber, sms },
    })

    return NextResponse.json({ ...(rows[0] ?? {}), sms })
  } catch (error) {
    console.error("[waitlist] notify failed:", error)
    return NextResponse.json({ error: "Failed to notify customer" }, { status: 500 })
  }
})

