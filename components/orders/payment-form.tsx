"use client"

import type React from "react"

import { useState } from "react"
import { useOrder } from "@/context/OrderContext"
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [amount, setAmount] = useState<number>(totalDue - totalPaid)
  const [reference, setReference] = useState("")
  const [paymentMethodId, setPaymentMethodId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSplitPayment, setIsSplitPayment] = useState(false)

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

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
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
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="splitPayment" className="text-sm">
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
          value={amount}
          onChange={(e) => setAmount(Number.parseFloat(e.target.value))}
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
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="cash" id="cash" />
            <Label htmlFor="cash">Cash</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="credit" id="credit" />
            <Label htmlFor="credit">Credit Card</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="debit" id="debit" />
            <Label htmlFor="debit">Debit Card</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mobile" id="mobile" />
            <Label htmlFor="mobile">Mobile Payment</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="gift" id="gift" />
            <Label htmlFor="gift">Gift Card</Label>
          </div>
        </RadioGroup>
      </div>

      {isCardPayment && (
        <div className="space-y-2">
          <Label htmlFor="paymentMethodId">Stripe Payment Method ID (Optional)</Label>
          <Input
            id="paymentMethodId"
            placeholder="pm_... (from Stripe Terminal)"
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to use simulated provider. Enter a Stripe payment method ID for real card processing.
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

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Process ${isSplitPayment ? "Partial" : "Full"} Payment ($${amount.toFixed(2)})`
        )}
      </Button>
    </form>
  )
}
