"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useOrder } from "@/context/OrderContext"
import { useKernel } from "@/kernel/react/kernel-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import type { PaymentMethod } from "@/types"

interface PaymentFormProps {
  orderId: string
  totalDue: number
  totalPaid: number
}

export function PaymentForm({ orderId, totalDue, totalPaid }: PaymentFormProps) {
  const { addPayment } = useOrder()
  const { ask } = useKernel()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [amount, setAmount] = useState<number>(totalDue - totalPaid)
  const [reference, setReference] = useState("")
  const [paymentMethodId, setPaymentMethodId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSplitPayment, setIsSplitPayment] = useState(false)
  const [providerHint, setProviderHint] = useState<string | null>(null)

  // Honest card banner: never imply real processing when manual/simulated.
  useEffect(() => {
    let alive = true
    void ask<{ provider: string; liveCards: boolean; hint: string }>("get.paymentProvider", {})
      .then((r) => {
        if (alive && r.success) setProviderHint((r.data as { hint: string }).hint)
      })
      .catch(() => null)
    return () => {
      alive = false
    }
  }, [ask])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (amount <= 0) {
      toast({
        title: "Error",
        description: "Payment amount must be greater than zero",
        variant: "destructive",
      })
      return
    }

    if (amount > totalDue - totalPaid) {
      toast({
        title: "Error",
        description: "Payment amount cannot exceed the remaining balance",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      await addPayment(orderId, {
        method: paymentMethod,
        amount,
        reference: reference || undefined,
        timestamp: new Date().toISOString(),
        paymentMethodId: paymentMethodId || undefined,
        gateway: paymentMethodId ? "stripe" : undefined,
      })

      toast({
        title: "Success",
        description: "Payment processed successfully",
      })

      // Reset form if it's a split payment and there's still a balance
      if (isSplitPayment && totalPaid + amount < totalDue) {
        setAmount(totalDue - (totalPaid + amount))
        setReference("")
        setPaymentMethodId("")
      }
    } catch (error) {
      console.error("Error processing payment:", error)
      toast({
        title: "Error",
        description: "Failed to process payment",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const remainingBalance = totalDue - totalPaid
  const isCardPayment = ["credit", "debit"].includes(paymentMethod)

  const handleAmountChange = (raw: string) => {
    // Empty / invalid input must not poison state with NaN (crashed toFixed render).
    if (raw.trim() === "") {
      setAmount(0)
      return
    }
    const parsed = Number.parseFloat(raw)
    if (Number.isNaN(parsed)) return
    // Clamp overpay at input time; submit re-validates as backstop.
    setAmount(Math.min(Math.max(parsed, 0), Math.max(remainingBalance, 0)))
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {isCardPayment && providerHint && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs" role="status">
          {providerHint}
        </p>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="amount">Payment Amount</Label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="splitPayment"
              checked={isSplitPayment}
              onChange={(e) => {
                setIsSplitPayment(e.target.checked)
                if (!e.target.checked) {
                  setAmount(remainingBalance)
                }
              }}
              className="h-6 w-6 rounded border-gray-300"
            />
            <Label htmlFor="splitPayment" className="min-h-[44px] text-sm flex items-center">
              Split Payment
            </Label>
          </div>
        </div>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0.01"
          max={remainingBalance}
          value={Number.isNaN(amount) ? 0 : amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Payment Method</Label>
        <RadioGroup
          value={paymentMethod}
          onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
          className="grid grid-cols-2 gap-2"
        >
          {([
            ["cash", "Cash"],
            ["credit", "Credit Card"],
            ["debit", "Debit Card"],
            ["mobile", "Mobile Payment"],
            ["gift", "Gift Card"],
          ] as [PaymentMethod, string][]).map(([value, label]) => (
            <Label key={value} htmlFor={`pay-${value}`} className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-md border px-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent">
              <RadioGroupItem value={value} id={`pay-${value}`} className="h-5 w-5" />
              <span className="text-sm font-medium">{label}</span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      {isCardPayment && (
        <div className="space-y-2">
          <Label htmlFor="paymentMethodId">Terminal reference (optional)</Label>
          <Input
            id="paymentMethodId"
            placeholder="pm_... / terminal receipt #"
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Manual recording only — no card is charged here. Card capture happens on the terminal; enter its reference above.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reference">Reference (Optional)</Label>
        <Input
          id="reference"
          placeholder="Transaction ID, Last 4 digits, etc."
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>

      <Button type="submit" size="lg" className="min-h-[48px] w-full" disabled={isSubmitting || !(amount > 0)}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Process ${isSplitPayment ? "Partial" : "Full"} Payment ($${(Number.isNaN(amount) ? 0 : amount).toFixed(2)})`
        )}
      </Button>
    </form>
  )
}
