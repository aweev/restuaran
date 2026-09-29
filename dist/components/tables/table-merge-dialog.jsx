"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableMergeDialog = TableMergeDialog;
const react_1 = require("react");
const TableContext_1 = require("@/context/TableContext");
const OrderContext_1 = require("@/context/OrderContext");
const dialog_1 = require("@/components/ui/dialog");
const button_1 = require("@/components/ui/button");
const checkbox_1 = require("@/components/ui/checkbox");
const label_1 = require("@/components/ui/label");
const use_toast_1 = require("@/components/ui/use-toast");
const lucide_react_1 = require("lucide-react");
function TableMergeDialog({ table, tables, open, onOpenChange }) {
    const { clearTable } = (0, TableContext_1.useTable)();
    const { mergeOrders } = (0, OrderContext_1.useOrder)();
    const [selectedTableIds, setSelectedTableIds] = (0, react_1.useState)([]);
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    // Filter tables to only show occupied tables
    const occupiedTables = tables.filter((t) => t.status === "occupied");
    const handleCheckboxChange = (tableId) => {
        setSelectedTableIds((prev) => (prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]));
    };
    const handleMerge = async () => {
        if (!table || selectedTableIds.length === 0)
            return;
        setIsSubmitting(true);
        try {
            // Merge orders from selected tables to the current table
            const mergedCount = await mergeOrders(table.id, selectedTableIds);
            // Clear the merged tables
            for (const tableId of selectedTableIds) {
                await clearTable(tableId);
            }
            onOpenChange(false);
            setSelectedTableIds([]);
            (0, use_toast_1.toast)({
                title: "Tables merged",
                description: `${selectedTableIds.length} tables have been merged with Table ${table.number}. ${mergedCount} orders combined.`,
            });
        }
        catch (error) {
            console.error("Error merging tables:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to merge tables.",
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
          <dialog_1.DialogTitle>Merge Tables with Table {table.number}</dialog_1.DialogTitle>
        </dialog_1.DialogHeader>

        <div className="space-y-4 py-4">
          <p>Select tables to merge with Table {table.number}:</p>

          {occupiedTables.length === 0 ? (<div className="rounded-md bg-yellow-50 p-4 text-yellow-800">
              No other occupied tables available to merge.
            </div>) : (<div className="space-y-2">
              {occupiedTables.map((t) => (<div key={t.id} className="flex items-center space-x-2">
                  <checkbox_1.Checkbox id={`table-${t.id}`} checked={selectedTableIds.includes(t.id)} onCheckedChange={() => handleCheckboxChange(t.id)}/>
                  <label_1.Label htmlFor={`table-${t.id}`} className="flex-1">
                    Table {t.number} - {t.customerName || "Customer"} ({t.customerCount || "?"} guests)
                  </label_1.Label>
                </div>))}
            </div>)}

          <div className="pt-4 text-sm text-muted-foreground">
            <p>
              This will combine all orders from the selected tables with Table {table.number}. The selected tables will
              be marked as needing cleaning.
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <button_1.Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </button_1.Button>
          <button_1.Button onClick={handleMerge} disabled={isSubmitting || selectedTableIds.length === 0 || occupiedTables.length === 0}>
            {isSubmitting ? (<>
                <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                Merging...
              </>) : ("Merge Tables")}
          </button_1.Button>
        </div>
      </dialog_1.DialogContent>
    </dialog_1.Dialog>);
}
