"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitListManager = WaitListManager;
const react_1 = require("react");
const WaitListContext_1 = require("@/context/WaitListContext");
const TableContext_1 = require("@/context/TableContext");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const card_1 = require("@/components/ui/card");
const badge_1 = require("@/components/ui/badge");
const scroll_area_1 = require("@/components/ui/scroll-area");
const dialog_1 = require("@/components/ui/dialog");
const date_fns_1 = require("date-fns");
const lucide_react_1 = require("lucide-react");
const use_toast_1 = require("@/components/ui/use-toast");
function WaitListManager({ tables }) {
    const { state, addEntry, removeEntry, notifyCustomer, seatCustomer } = (0, WaitListContext_1.useWaitList)();
    const { occupyTable } = (0, TableContext_1.useTable)();
    const [newEntry, setNewEntry] = (0, react_1.useState)({
        customerName: "",
        phoneNumber: "",
        partySize: 2,
        notes: "",
    });
    const [isAddDialogOpen, setIsAddDialogOpen] = (0, react_1.useState)(false);
    const [selectedEntry, setSelectedEntry] = (0, react_1.useState)(null);
    const [isNotifyDialogOpen, setIsNotifyDialogOpen] = (0, react_1.useState)(false);
    const [isSeatDialogOpen, setIsSeatDialogOpen] = (0, react_1.useState)(false);
    const [selectedTable, setSelectedTable] = (0, react_1.useState)("");
    // Get available tables that can accommodate the party size
    const getAvailableTables = (partySize) => {
        return tables.filter((table) => table.status === "available" && table.capacity >= partySize);
    };
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewEntry(Object.assign(Object.assign({}, newEntry), { [name]: name === "partySize" ? Number.parseInt(value) || 1 : value }));
    };
    const handleAddEntry = async () => {
        if (!newEntry.customerName || newEntry.partySize < 1) {
            (0, use_toast_1.toast)({
                title: "Missing information",
                description: "Please provide a customer name and party size.",
                variant: "destructive",
            });
            return;
        }
        try {
            await addEntry(Object.assign(Object.assign({}, newEntry), { estimatedWaitTime: calculateEstimatedWaitTime(newEntry.partySize) }));
            setNewEntry({
                customerName: "",
                phoneNumber: "",
                partySize: 2,
                notes: "",
            });
            setIsAddDialogOpen(false);
            (0, use_toast_1.toast)({
                title: "Added to wait list",
                description: `${newEntry.customerName} has been added to the wait list.`,
            });
        }
        catch (error) {
            console.error("Error adding to wait list:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to add customer to wait list.",
                variant: "destructive",
            });
        }
    };
    const handleRemoveEntry = async (id) => {
        try {
            await removeEntry(id);
            (0, use_toast_1.toast)({
                title: "Removed from wait list",
                description: "Customer has been removed from the wait list.",
            });
        }
        catch (error) {
            console.error("Error removing from wait list:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to remove customer from wait list.",
                variant: "destructive",
            });
        }
    };
    const handleNotifyCustomer = async () => {
        if (!selectedEntry)
            return;
        try {
            await notifyCustomer(selectedEntry.id);
            setIsNotifyDialogOpen(false);
            (0, use_toast_1.toast)({
                title: "Customer notified",
                description: `${selectedEntry.customerName} has been notified that their table is ready.`,
            });
        }
        catch (error) {
            console.error("Error notifying customer:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to notify customer.",
                variant: "destructive",
            });
        }
    };
    const handleSeatCustomer = async () => {
        var _a;
        if (!selectedEntry || !selectedTable)
            return;
        try {
            // First occupy the table
            await occupyTable(selectedTable, selectedEntry.customerName, selectedEntry.partySize, "Server");
            // Then remove from wait list
            await seatCustomer(selectedEntry.id, selectedTable);
            setIsSeatDialogOpen(false);
            setSelectedEntry(null);
            (0, use_toast_1.toast)({
                title: "Customer seated",
                description: `${selectedEntry.customerName} has been seated at table ${(_a = tables.find((t) => t.id === selectedTable)) === null || _a === void 0 ? void 0 : _a.number}.`,
            });
        }
        catch (error) {
            console.error("Error seating customer:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to seat customer.",
                variant: "destructive",
            });
        }
    };
    // Calculate estimated wait time based on party size and current occupancy
    const calculateEstimatedWaitTime = (partySize) => {
        const availableTables = getAvailableTables(partySize);
        if (availableTables.length > 0) {
            return 0; // No wait if tables are available
        }
        // Base wait time of 15 minutes
        let waitTime = 15;
        // Add time based on number of parties ahead with similar size requirements
        const partiesAhead = state.entries.filter((entry) => entry.partySize >= partySize).length;
        waitTime += partiesAhead * 10;
        // Adjust based on current occupancy
        const occupancyRate = tables.length > 0 ? tables.filter((t) => t.status === "occupied").length / tables.length : 0;
        waitTime = Math.round(waitTime * (1 + occupancyRate));
        return waitTime;
    };
    // Get wait time display
    const getWaitTimeDisplay = (entry) => {
        const createdAt = new Date(entry.createdAt);
        const waitedMinutes = (0, date_fns_1.differenceInMinutes)(new Date(), createdAt);
        if (entry.estimatedWaitTime === 0) {
            return "Ready to seat";
        }
        if (waitedMinutes >= entry.estimatedWaitTime) {
            return "Table should be ready";
        }
        return `~${entry.estimatedWaitTime - waitedMinutes} min remaining`;
    };
    // Get wait time status color
    const getWaitTimeStatusColor = (entry) => {
        const createdAt = new Date(entry.createdAt);
        const waitedMinutes = (0, date_fns_1.differenceInMinutes)(new Date(), createdAt);
        if (entry.estimatedWaitTime === 0 || waitedMinutes >= entry.estimatedWaitTime) {
            return "bg-green-100 text-green-800";
        }
        if (waitedMinutes >= entry.estimatedWaitTime * 0.8) {
            return "bg-yellow-100 text-yellow-800";
        }
        return "bg-blue-100 text-blue-800";
    };
    return (<div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Current Wait List ({state.entries.length})</h3>
        <dialog_1.Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <dialog_1.DialogTrigger asChild>
            <button_1.Button>
              <lucide_react_1.Plus className="mr-2 h-4 w-4"/> Add to Wait List
            </button_1.Button>
          </dialog_1.DialogTrigger>
          <dialog_1.DialogContent>
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle>Add to Wait List</dialog_1.DialogTitle>
            </dialog_1.DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label_1.Label htmlFor="customerName">Customer Name</label_1.Label>
                <input_1.Input id="customerName" name="customerName" value={newEntry.customerName} onChange={handleInputChange}/>
              </div>

              <div className="space-y-2">
                <label_1.Label htmlFor="phoneNumber">Phone Number</label_1.Label>
                <input_1.Input id="phoneNumber" name="phoneNumber" value={newEntry.phoneNumber} onChange={handleInputChange}/>
              </div>

              <div className="space-y-2">
                <label_1.Label htmlFor="partySize">Party Size</label_1.Label>
                <input_1.Input id="partySize" name="partySize" type="number" min={1} value={newEntry.partySize} onChange={handleInputChange}/>
              </div>

              <div className="space-y-2">
                <label_1.Label htmlFor="notes">Notes</label_1.Label>
                <input_1.Input id="notes" name="notes" value={newEntry.notes} onChange={handleInputChange}/>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button_1.Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </button_1.Button>
              <button_1.Button onClick={handleAddEntry}>Add to Wait List</button_1.Button>
            </div>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>
      </div>

      <scroll_area_1.ScrollArea className="h-[400px]">
        {state.entries.length === 0 ? (<div className="flex h-32 items-center justify-center text-muted-foreground">
            No customers currently waiting
          </div>) : (<div className="space-y-2">
            {state.entries.map((entry) => (<card_1.Card key={entry.id}>
                <card_1.CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{entry.customerName}</h4>
                        <badge_1.Badge variant="outline" className={getWaitTimeStatusColor(entry)}>
                          {getWaitTimeDisplay(entry)}
                        </badge_1.Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <lucide_react_1.Users className="h-4 w-4"/>
                          <span>{entry.partySize} guests</span>
                        </div>
                        {entry.phoneNumber && (<div className="flex items-center gap-1">
                            <lucide_react_1.Phone className="h-4 w-4"/>
                            <span>{entry.phoneNumber}</span>
                          </div>)}
                        <div className="flex items-center gap-1">
                          <lucide_react_1.Clock className="h-4 w-4"/>
                          <span>Added {(0, date_fns_1.format)(new Date(entry.createdAt), "h:mm a")}</span>
                        </div>
                      </div>
                      {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <dialog_1.Dialog>
                        <dialog_1.DialogTrigger asChild>
                          <button_1.Button variant="outline" size="icon" onClick={() => {
                    setSelectedEntry(entry);
                    setIsNotifyDialogOpen(true);
                }}>
                            <lucide_react_1.Bell className="h-4 w-4"/>
                          </button_1.Button>
                        </dialog_1.DialogTrigger>
                        <dialog_1.DialogContent>
                          <dialog_1.DialogHeader>
                            <dialog_1.DialogTitle>Notify Customer</dialog_1.DialogTitle>
                          </dialog_1.DialogHeader>
                          <div className="py-4">
                            <p>
                              Are you sure you want to notify {entry.customerName} that their table is ready?
                              {entry.phoneNumber ? (<span> A text message will be sent to {entry.phoneNumber}.</span>) : (<span> No phone number is available for SMS notification.</span>)}
                            </p>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button_1.Button variant="outline" onClick={() => setIsNotifyDialogOpen(false)}>
                              Cancel
                            </button_1.Button>
                            <button_1.Button onClick={handleNotifyCustomer}>Notify Customer</button_1.Button>
                          </div>
                        </dialog_1.DialogContent>
                      </dialog_1.Dialog>

                      <dialog_1.Dialog>
                        <dialog_1.DialogTrigger asChild>
                          <button_1.Button variant="default" size="sm" onClick={() => {
                    setSelectedEntry(entry);
                    setIsSeatDialogOpen(true);
                    setSelectedTable("");
                }}>
                            Seat
                          </button_1.Button>
                        </dialog_1.DialogTrigger>
                        <dialog_1.DialogContent>
                          <dialog_1.DialogHeader>
                            <dialog_1.DialogTitle>Seat Customer</dialog_1.DialogTitle>
                          </dialog_1.DialogHeader>
                          <div className="py-4 space-y-4">
                            <p>
                              Select a table to seat {entry.customerName}'s party of {entry.partySize}:
                            </p>

                            <div className="grid grid-cols-2 gap-2">
                              {getAvailableTables(entry.partySize).length > 0 ? (getAvailableTables(entry.partySize).map((table) => (<button_1.Button key={table.id} variant={selectedTable === table.id ? "default" : "outline"} className="justify-start" onClick={() => setSelectedTable(table.id)}>
                                    Table {table.number} (Seats {table.capacity})
                                  </button_1.Button>))) : (<p className="col-span-2 text-center text-muted-foreground">
                                  No suitable tables available
                                </p>)}
                            </div>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button_1.Button variant="outline" onClick={() => setIsSeatDialogOpen(false)}>
                              Cancel
                            </button_1.Button>
                            <button_1.Button onClick={handleSeatCustomer} disabled={!selectedTable}>
                              Seat Customer
                            </button_1.Button>
                          </div>
                        </dialog_1.DialogContent>
                      </dialog_1.Dialog>

                      <button_1.Button variant="ghost" size="icon" onClick={() => handleRemoveEntry(entry.id)}>
                        <lucide_react_1.X className="h-4 w-4"/>
                      </button_1.Button>
                    </div>
                  </div>
                </card_1.CardContent>
              </card_1.Card>))}
          </div>)}
      </scroll_area_1.ScrollArea>
    </div>);
}
