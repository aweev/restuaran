"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptModal = ReceiptModal;
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const button_1 = require("@/components/ui/button");
const dialog_1 = require("@/components/ui/dialog");
function ReceiptModal({ order, open, onOpenChange }) {
    const receiptRef = (0, react_1.useRef)(null);
    if (!order)
        return null;
    const handlePrint = () => {
        const printContent = receiptRef.current;
        if (!printContent)
            return;
        const windowUrl = "about:blank";
        const uniqueName = new Date().getTime();
        const windowName = "Print" + uniqueName;
        const printWindow = window.open(windowUrl, windowName, "width=400,height=600");
        if (printWindow) {
            printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt - Order #${order.id.slice(0, 8)}</title>
            <style>
              body {
                font-family: 'Courier New', Courier, monospace;
                width: 80mm;
                margin: 0 auto;
                padding: 10px;
                font-size: 12px;
                color: #000;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .font-bold { font-weight: bold; }
              .border-b { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
              .border-t { border-top: 1px dashed #000; padding-top: 8px; margin-top: 8px; }
              .flex { display: flex; justify-content: space-between; }
              .item-row { margin-bottom: 4px; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `);
            printWindow.document.close();
        }
    };
    return (<dialog_1.Dialog open={open} onOpenChange={onOpenChange}>
      <dialog_1.DialogContent className="sm:max-w-md">
        <dialog_1.DialogHeader>
          <dialog_1.DialogTitle className="flex items-center gap-2">
            <lucide_react_1.Receipt className="h-5 w-5 text-primary"/>
            Thermal Receipt Preview
          </dialog_1.DialogTitle>
        </dialog_1.DialogHeader>

        <div className="my-2 max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/20 p-4">
          <div ref={receiptRef} className="mx-auto w-[280px] bg-white p-4 font-mono text-xs text-black shadow-sm">
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
              {order.tableId && (<div className="flex justify-between">
                  <span>Table:</span>
                  <span>#{order.tableId}</span>
                </div>)}
            </div>

            {/* Items */}
            <div className="border-b py-2">
              <div className="flex font-bold text-[10px] uppercase text-gray-500 border-b pb-1">
                <span>Item</span>
                <span>Qty x Price</span>
                <span>Total</span>
              </div>
              {order.items.map((item, idx) => (<div key={idx} className="my-1">
                  <div className="flex justify-between font-bold">
                    <span>{item.title}</span>
                    <span>${item.totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>
                      ${item.price.toFixed(2)} x {item.quantity}
                    </span>
                  </div>
                </div>))}
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
              {order.discount > 0 && (<div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-${order.discount.toFixed(2)}</span>
                </div>)}
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

        <dialog_1.DialogFooter className="gap-2 sm:gap-0">
          <button_1.Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </button_1.Button>
          <button_1.Button onClick={handlePrint} className="gap-2">
            <lucide_react_1.Printer className="h-4 w-4"/> Print Receipt
          </button_1.Button>
        </dialog_1.DialogFooter>
      </dialog_1.DialogContent>
    </dialog_1.Dialog>);
}
