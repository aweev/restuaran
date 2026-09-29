"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableTransferDialog = TableTransferDialog;
const react_1 = require("react");
const TableContext_1 = require("@/context/TableContext");
const OrderContext_1 = require("@/context/OrderContext");
const dialog_1 = require("@/components/ui/dialog");
const button_1 = require("@/components/ui/button");
const radio_group_1 = require("@/components/ui/radio-group");
const label_1 = require("@/components/ui/label");
const use_toast_1 = require("@/components/ui/use-toast");
const lucide_react_1 = require("lucide-react");
function TableTransferDialog({ table, tables, open, onOpenChange }) {
    const { clearTable, occupyTable } = (0, TableContext_1.useTable)();
    const { transferOrderTable } = (0, OrderContext_1.useOrder)();
    const [selectedTableId, setSelectedTableId] = (0, react_1.useState)("");
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    // Filter tables to only show available tables
    const availableTables = tables.filter((t) => t.status === "available");
    const handleTransfer = async () => {
        if (!table || !selectedTableId)
            return;
        setIsSubmitting(true);
        try {
            // Get the target table
            const targetTable = tables.find((t) => t.id === selectedTableId);
            if (!targetTable)
                throw new Error("Target table not found");
            // Get active orders for the current table
            const activeOrders = await transferOrderTable(table.id, selectedTableId);
            // Update the target table status
            await occupyTable(selectedTableId, table.customerName || "Customer", table.customerCount || 1, table.serverName || "Server");
            // Clear the original table
            await clearTable(table.id);
            onOpenChange(false);
            (0, use_toast_1.toast)({
                title: "Table transferred",
                description: `Table ${table.number} has been transferred to Table ${targetTable.number} with ${activeOrders} orders.`,
            });
        }
        catch (error) {
            console.error("Error transferring table:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to transfer table.",
                variant: "destructive",
            });
        }
        finally {
            setIsSubmitting(false);
        }
    };
    if (!table)
        return null;
    return (<dialog_1.Dialog open={open} onOpenChange={onOpenChange}>
      <dialog_1.DialogContent>
        <dialog_1.DialogHeader>
          <dialog_1.DialogTitle>Transfer Table {table.number}</dialog_1.DialogTitle>
        </dialog_1.DialogHeader>

        <div className="space-y-4 py-4">
          <p>
            Transfer {table.customerName || "Customer"}'s party of {table.customerCount || "?"}
            from Table {table.number} to another table:
          </p>

          {availableTables.length === 0 ? (<div className="rounded-md bg-yellow-50 p-4 text-yellow-800">
              No available tables to transfer to. Please clear a table first.
            </div>) : (<radio_group_1.RadioGroup value={selectedTableId} onValueChange={setSelectedTableId}>
              <div className="space-y-2">
                {availableTables.map((t) => (<div key={t.id} className="flex items-center space-x-2">
                    <radio_group_1.RadioGroupItem value={t.id} id={`table-${t.id}`}/>
                    <label_1.Label htmlFor={`table-${t.id}`} className="flex-1">
                      Table {t.number} (Capacity: {t.capacity})
                    </label_1.Label>
                  </div>))}
              </div>
            </radio_group_1.RadioGroup>)}

          <div className="pt-4 text-sm text-muted-foreground">
            <p>
              This will transfer all active orders and customer information to the new table. The current table will be
              marked as needing cleaning.
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <button_1.Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </button_1.Button>
          <button_1.Button onClick={handleTransfer} disabled={isSubmitting || !selectedTableId || availableTables.length === 0}>
            {isSubmitting ? (<>
                <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                Transferring...
              </>) : ("Transfer Table")}
          </button_1.Button>
        </div>
      </dialog_1.DialogContent>
    </dialog_1.Dialog>);
}
