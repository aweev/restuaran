"use client"

import { useRef, useState } from "react"
import { Printer, Receipt as ReceiptIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { printHtml, retryPrintJob } from "@/lib/print"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import type { Order } from "@/types/index"

interface ReceiptModalProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReceiptModal({ order, open, onOpenChange }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [failedJob, setFailedJob] = useState<string | null>(null)

  if (!order) return null

  const handlePrint = () => {
    const printContent = receiptRef.current
    if (!printContent) return

    // Single print path (lib/print.ts): queued job + retry on blocked popup.
    void printHtml(`Receipt - Order #${order.id.slice(0, 8)}`, printContent.innerHTML).then(({ ok, jobId }) => {
      setFailedJob(ok ? null : jobId)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="h-5 w-5 text-primary" />
            Thermal Receipt Preview
          </DialogTitle>
        </DialogHeader>

        <div className="my-2 max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/20 p-4">
          <div
            ref={receiptRef}
            className="mx-auto w-[280px] bg-white p-4 font-mono text-xs text-black shadow-sm"
          >
            {/* Header */}
            <div className="border-b text-center">
              <h2 className="text-base font-bold uppercase tracking-wider">RESTAU POS</h2>
              <p className="text-[10px] text-gray-600">123 Culinary Avenue, Suite 100</p>
              <p className="text-[10px] text-gray-600">Tel: +1 (555) 019-2831</p>
              <p className="mt-1 text-[11px] font-bold">
                {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>

            {/* Meta */}
            <div className="border-b py-2 text-[11px]">
              <div className="flex justify-between">
                <span>Order #:</span>
                <span className="font-bold">{order.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{order.customerName || "Guest Walk-in"}</span>
              </div>
              <div className="flex justify-between">
                <span>Dining Mode:</span>
                <span className="capitalize">{order.diningMode || "Dine-In"}</span>
              </div>
              {order.tableId && (
                <div className="flex justify-between">
                  <span>Table:</span>
                  <span>#{order.tableId}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="border-b py-2">
              <div className="flex font-bold text-[10px] uppercase text-gray-500 border-b pb-1">
                <span>Item</span>
                <span>Qty x Price</span>
                <span>Total</span>
              </div>
              {order.items.map((item, idx) => (
                <div key={idx} className="my-1">
                  <div className="flex justify-between font-bold">
                    <span>{item.title}</span>
                    <span>${item.totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>
                      ${item.price.toFixed(2)} x {item.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="py-2 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${(order.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax (5%):</span>
                <span>${(order.tax || 0).toFixed(2)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-${order.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-b py-1 text-sm font-bold">
                <span>TOTAL:</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-3 text-center text-[10px] text-gray-500">
              <p className="font-bold">Thank you for dining with us!</p>
              <p className="mt-1">Please come again</p>
              <p className="mt-2 text-[8px]">*** Customer Copy ***</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {failedJob ? (
            <Button
              variant="destructive"
              onClick={() => {
                void retryPrintJob(failedJob).then((ok) => {
                  if (ok) setFailedJob(null)
                })
              }}
              className="gap-2"
            >
              <Printer className="h-4 w-4" /> Print blocked — retry
            </Button>
          ) : (
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" /> Print Receipt
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
