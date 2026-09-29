"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableDetailsDialog = TableDetailsDialog;
const react_1 = require("react");
const TableContext_1 = require("@/context/TableContext");
const AuthContext_1 = require("@/context/AuthContext");
const dialog_1 = require("@/components/ui/dialog");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const badge_1 = require("@/components/ui/badge");
const date_fns_1 = require("date-fns");
function TableDetailsDialog({ table, open, onOpenChange, onClose }) {
    const { updateTableStatus, occupyTable, clearTable } = (0, TableContext_1.useTable)();
    const { state: authState } = (0, AuthContext_1.useAuth)();
    const [customerName, setCustomerName] = (0, react_1.useState)("");
    const [customerCount, setCustomerCount] = (0, react_1.useState)(1);
    const [isUpdating, setIsUpdating] = (0, react_1.useState)(false);
    if (!table)
        return null;
    const getStatusColor = (status) => {
        switch (status) {
            case "available":
                return "bg-green-100 text-green-800";
            case "occupied":
                return "bg-red-100 text-red-800";
            case "reserved":
                return "bg-blue-100 text-blue-800";
            case "dirty":
                return "bg-yellow-100 text-yellow-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };
    const handleOccupyTable = async () => {
        if (!customerName || customerCount < 1 || !authState.user)
            return;
        setIsUpdating(true);
        try {
            await occupyTable(table.id, customerName, customerCount, authState.user.name);
            onClose();
        }
        catch (error) {
            console.error("Error occupying table:", error);
        }
        finally {
            setIsUpdating(false);
        }
    };
    const handleClearTable = async () => {
        setIsUpdating(true);
        try {
            await clearTable(table.id);
            onClose();
        }
        catch (error) {
            console.error("Error clearing table:", error);
        }
        finally {
            setIsUpdating(false);
        }
    };
    const handleMarkAvailable = async () => {
        setIsUpdating(true);
        try {
            await updateTableStatus(table.id, "available");
            onClose();
        }
        catch (error) {
            console.error("Error updating table status:", error);
        }
        finally {
            setIsUpdating(false);
        }
    };
    return (<dialog_1.Dialog open={open} onOpenChange={onOpenChange}>
      <dialog_1.DialogContent className="sm:max-w-[425px]">
        <dialog_1.DialogHeader>
          <dialog_1.DialogTitle className="flex items-center justify-between">
            Table {table.number}
            <badge_1.Badge variant="outline" className={getStatusColor(table.status)}>
              {table.status}
            </badge_1.Badge>
          </dialog_1.DialogTitle>
          <dialog_1.DialogDescription>Capacity: {table.capacity} people</dialog_1.DialogDescription>
        </dialog_1.DialogHeader>

        {table.status === "occupied" && (<div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Customer:</span>
              <span>{table.customerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Party Size:</span>
              <span>{table.customerCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Server:</span>
              <span>{table.serverName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Start Time:</span>
              <span>{table.startTime ? (0, date_fns_1.format)(new Date(table.startTime), "h:mm a") : "N/A"}</span>
            </div>
          </div>)}

        {table.status === "reserved" && (<div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Reserved For:</span>
              <span>{table.customerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Party Size:</span>
              <span>{table.customerCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Reservation Time:</span>
              <span>{table.startTime ? (0, date_fns_1.format)(new Date(table.startTime), "h:mm a") : "N/A"}</span>
            </div>
          </div>)}

        {table.status === "available" && (<div className="space-y-4">
            <div className="space-y-2">
              <label_1.Label htmlFor="customerName">Customer Name</label_1.Label>
              <input_1.Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)}/>
            </div>
            <div className="space-y-2">
              <label_1.Label htmlFor="customerCount">Number of Guests</label_1.Label>
              <input_1.Input id="customerCount" type="number" min={1} max={table.capacity} value={customerCount} onChange={(e) => setCustomerCount(Number.parseInt(e.target.value))}/>
            </div>
          </div>)}

        <dialog_1.DialogFooter>
          {table.status === "available" && (<button_1.Button onClick={handleOccupyTable} disabled={!customerName || customerCount < 1 || isUpdating}>
              {isUpdating ? "Updating..." : "Seat Customers"}
            </button_1.Button>)}

          {table.status === "occupied" && (<button_1.Button onClick={handleClearTable} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Clear Table"}
            </button_1.Button>)}

          {table.status === "dirty" && (<button_1.Button onClick={handleMarkAvailable} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Mark as Available"}
            </button_1.Button>)}

          {table.status === "reserved" && (<>
              <button_1.Button onClick={handleOccupyTable} disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Seat Reservation"}
              </button_1.Button>
              <button_1.Button variant="outline" onClick={handleMarkAvailable} disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Cancel Reservation"}
              </button_1.Button>
            </>)}
        </dialog_1.DialogFooter>
      </dialog_1.DialogContent>
    </dialog_1.Dialog>);
}
