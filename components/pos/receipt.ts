"use client";

import jsPDF from "jspdf";
import { getVenueSettings, roundCash } from "@/lib/settings";
import type { Order } from "@/types";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

/**
 * Simple printable receipt via jsPDF (already a dependency).
 * Includes venue name, lines, tax, total and change-due.
 */
export function printReceipt(order: Order, cashTendered?: number) {
  const venue = getVenueSettings();
  const doc = new jsPDF({ unit: "pt", format: [220, 600] });
  let y = 24;
  const line = (text: string, opts?: { bold?: boolean; size?: number; gap?: number }) => {
    doc.setFont("courier", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 9);
    doc.text(text, 12, y);
    y += opts?.gap ?? 13;
  };

  line(venue.name || "Maison Chili POS", { bold: true, size: 12, gap: 16 });
  line(`Order #${order.id.slice(0, 8)}`);
  line(new Date(order.createdAt).toLocaleString());
  line(`${order.diningMode}${order.tableId ? ` · Table ${order.table?.number ?? order.tableId}` : ""}`);
  if (order.customerName) line(`Customer: ${order.customerName}`);
  line("--------------------------------");
  for (const item of order.items) {
    line(`${item.quantity}x ${item.title}`);
    if (item.specialInstructions) line(`  * ${item.specialInstructions}`);
    doc.text(money(item.totalPrice), 208, y - 13, { align: "right" });
  }
  line("--------------------------------");
  line(`Subtotal: ${money(order.subtotal)}`);
  line(`Tax: ${money(order.tax)}`);
  if (order.discount > 0) line(`Discount: -${money(order.discount)}`);
  line(`TOTAL: ${money(order.total)}`, { bold: true, size: 11, gap: 16 });
  const cashTotal = roundCash(order.total, venue.roundingIncrement);
  if (cashTotal !== order.total) line(`Cash total (rounded): ${money(cashTotal)}`);
  if (order.payments?.length) {
    for (const p of order.payments) line(`${p.method.toUpperCase()}: ${money(p.amount)}`);
  }
  if (typeof cashTendered === "number" && cashTendered > 0) {
    line(`Tendered: ${money(cashTendered)}`);
    line(`Change due: ${money(Math.max(0, cashTendered - cashTotal))}`, { bold: true });
  }
  line("--------------------------------");
  line("Thank you!", { gap: 8 });
  doc.save(`receipt-${order.id.slice(0, 8)}.pdf`);
}
