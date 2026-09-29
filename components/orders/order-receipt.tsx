"use client"

import type { Order } from "@/types"
import { format } from "date-fns"

interface OrderReceiptProps {
  order: Order
}

export function OrderReceipt({ order }: OrderReceiptProps) {
  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <div className="text-center">
        <h2 className="text-xl font-bold">Restaurant POS</h2>
        <p className="text-sm text-muted-foreground">123 Main Street, City</p>
        <p className="text-sm text-muted-foreground">Tel: (123) 456-7890</p>
      </div>

      <div className="space-y-1 text-center">
        <p className="text-sm">Order #{order.id.substring(0, 8)}</p>
        <p className="text-sm">{format(new Date(order.createdAt), "PPpp")}</p>
        <p className="text-sm">
          {order.diningMode} - {order.tableId ? `Table ${order.table?.number}` : "Takeaway"}
        </p>
        {order.customerName && <p className="text-sm">Customer: {order.customerName}</p>}
        <p className="text-sm">Server: {order.serverId}</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between border-b pb-2 text-sm font-medium">
          <span>Item</span>
          <span>Total</span>
        </div>

        {order.items.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>
                {item.quantity}x {item.title}
              </span>
              <span>${item.totalPrice.toFixed(2)}</span>
            </div>
            {item.specialInstructions && (
              <p className="text-xs text-muted-foreground">Note: {item.specialInstructions}</p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1 border-t pt-2">
        <div className="flex justify-between text-sm">
          <span>Subtotal:</span>
          <span>${order.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Tax:</span>
          <span>${order.tax.toFixed(2)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between text-sm text-red-500">
            <span>Discount:</span>
            <span>-${order.discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-1 text-base font-bold">
          <span>Total:</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
      </div>

      {order.payments.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          <p className="text-sm font-medium">Payments:</p>
          {order.payments.map((payment, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>{payment.method.toUpperCase()}</span>
              <span>${payment.amount.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-1 text-sm font-medium">
            <span>Total Paid:</span>
            <span>${order.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</span>
          </div>
          {!order.isPaid && (
            <div className="flex justify-between text-sm font-medium text-red-500">
              <span>Balance Due:</span>
              <span>${(order.total - order.payments.reduce((sum, p) => sum + p.amount, 0)).toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1 text-center">
        <p className="text-sm">Thank you for your order!</p>
        <p className="text-xs text-muted-foreground">{order.isPaid ? "Paid in Full" : "Balance Due"}</p>
      </div>
    </div>
  )
}
