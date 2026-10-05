import { type NextRequest, NextResponse } from "next/server"
import { one, sqlWrite, audit, toNum } from "@/lib/db-helpers"
import { z } from "zod"

const redeemSchema = z.object({
  customerId: z.string().min(1),
  rewardId: z.string().min(1),
  tableNumber: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const v = redeemSchema.parse(await req.json())

    const reward = await one<{ id: string; name: string; pointsCost: unknown; available: boolean }>(
      `SELECT id, name, "pointsCost", available FROM "LoyaltyReward" WHERE id = $1`,
      [v.rewardId],
    )
    if (!reward) return NextResponse.json({ error: "Reward not found" }, { status: 404 })
    if (!reward.available) {
      return NextResponse.json({ error: "Reward is not available" }, { status: 400 })
    }
    const cost = toNum(reward.pointsCost)

    // The balance check and the deduction must be one atomic operation, or two
    // guests redeeming their last points concurrently both succeed. The
    // conditional UPDATE is what makes that safe — a plain read-then-write left
    // the window open.
    await sqlWrite("BEGIN")
    let newPoints = 0
    let redemption: Record<string, unknown> = {}
    try {
      const debited = await sqlWrite(
        `UPDATE "LoyaltyCustomer"
            SET points = points - $2, "lastActivity" = NOW()
          WHERE id = $1 AND points >= $2
          RETURNING points`,
        [v.customerId, cost],
      )

      if (debited.length === 0) {
        await sqlWrite("ROLLBACK")
        const exists = await one(`SELECT points FROM "LoyaltyCustomer" WHERE id = $1`, [v.customerId])
        if (!exists) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
        return NextResponse.json({ error: "Insufficient points" }, { status: 400 })
      }

      newPoints = toNum(debited[0].points)

      const inserted = await sqlWrite(
        `INSERT INTO "LoyaltyRedemption" (id, "customerId", "rewardId", "pointsCost", "tableNumber", timestamp)
         VALUES ($1,$2,$3,$4,$5,NOW())
         RETURNING *`,
        [crypto.randomUUID(), v.customerId, v.rewardId, cost, v.tableNumber ?? null],
      )
      redemption = inserted[0] ?? {}

      await sqlWrite(
        `INSERT INTO "LoyaltyActivity" (id, "customerId", type, points, description, timestamp)
         VALUES ($1,$2,'redemption',$3,$4,NOW())`,
        [crypto.randomUUID(), v.customerId, -cost, `Redeemed: ${reward.name}`],
      )
      await sqlWrite("COMMIT")
    } catch (txErr) {
      await sqlWrite("ROLLBACK").catch(() => undefined)
      throw txErr
    }

    await audit({
      userId: null,
      action: "REDEEM",
      entity: "LOYALTY",
      entityId: v.customerId,
      details: { reward: reward.name, pointsCost: cost, newPointsBalance: newPoints },
    })

    return NextResponse.json({ success: true, redemption, newPointsBalance: newPoints })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("[loyalty] redeem failed:", error)
    return NextResponse.json({ error: "Failed to redeem reward" }, { status: 500 })
  }
}

