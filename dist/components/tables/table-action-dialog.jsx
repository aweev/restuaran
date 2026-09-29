"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableActionDialog = TableActionDialog;
const react_1 = require("react");
const TableContext_1 = require("@/context/TableContext");
const dialog_1 = require("@/components/ui/dialog");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const select_1 = require("@/components/ui/select");
const use_toast_1 = require("@/components/ui/use-toast");
const lucide_react_1 = require("lucide-react");
function TableActionDialog({ open, onOpenChange }) {
    const { addTable } = (0, TableContext_1.useTable)();
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const [formData, setFormData] = (0, react_1.useState)({
        number: "",
        capacity: 4,
        status: "available",
        positionX: 100,
        positionY: 100,
    });
    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(Object.assign(Object.assign({}, formData), { [name]: type === "number" ? Number.parseInt(value) : value }));
    };
    const handleSelectChange = (name, value) => {
        setFormData(Object.assign(Object.assign({}, formData), { [name]: value }));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.number) {
            (0, use_toast_1.toast)({
                title: "Missing information",
                description: "Please provide a table number.",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);
        try {
            await addTable({
                id: crypto.randomUUID(),
                number: formData.number,
                capacity: formData.capacity,
                status: formData.status,
                position: {
                    x: formData.positionX,
                    y: formData.positionY,
                },
            });
            setFormData({
                number: "",
                capacity: 4,
                status: "available",
                positionX: 100,
                positionY: 100,
            });
            onOpenChange(false);
            (0, use_toast_1.toast)({
                title: "Table added",
                description: `Table ${formData.number} has been added successfully.`,
            });
        }
        catch (error) {
            console.error("Error adding table:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to add table. The table number may already exist.",
                variant: "destructive",
            });
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<dialog_1.Dialog open={open} onOpenChange={onOpenChange}>
      <dialog_1.DialogContent>
        <dialog_1.DialogHeader>
          <dialog_1.DialogTitle>Add New Table</dialog_1.DialogTitle>
        </dialog_1.DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label_1.Label htmlFor="number">Table Number</label_1.Label>
              <input_1.Input id="number" name="number" value={formData.number} onChange={handleInputChange} placeholder="e.g., 1, A1, etc."/>
            </div>

            <div className="space-y-2">
              <label_1.Label htmlFor="capacity">Seating Capacity</label_1.Label>
              <input_1.Input id="capacity" name="capacity" type="number" min={1} max={20} value={formData.capacity} onChange={handleInputChange}/>
            </div>

            <div className="space-y-2">
              <label_1.Label htmlFor="status">Initial Status</label_1.Label>
              <select_1.Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                <select_1.SelectTrigger id="status">
                  <select_1.SelectValue placeholder="Select status"/>
                </select_1.SelectTrigger>
                <select_1.SelectContent>
                  <select_1.SelectItem value="available">Available</select_1.SelectItem>
                  <select_1.SelectItem value="reserved">Reserved</select_1.SelectItem>
                  <select_1.SelectItem value="occupied">Occupied</select_1.SelectItem>
                  <select_1.SelectItem value="dirty">Needs Cleaning</select_1.SelectItem>
                </select_1.SelectContent>
              </select_1.Select>
            </div>

            <div className="space-y-2">
              <label_1.Label>Initial Position</label_1.Label>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <input_1.Input id="positionX" name="positionX" type="number" min={0} max={800} value={formData.positionX} onChange={handleInputChange} placeholder="X"/>
                </div>
                <div className="flex-1">
                  <input_1.Input id="positionY" name="positionY" type="number" min={0} max={600} value={formData.positionY} onChange={handleInputChange} placeholder="Y"/>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                You can adjust the position later in the floor plan editor.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button_1.Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </button_1.Button>
            <button_1.Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (<>
                  <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  Adding...
                </>) : ("Add Table")}
            </button_1.Button>
          </div>
        </form>
      </dialog_1.DialogContent>
    </dialog_1.Dialog>);
}
