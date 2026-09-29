"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditReservationForm = EditReservationForm;
const react_1 = require("react");
const ReservationContext_1 = require("@/context/ReservationContext");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const textarea_1 = require("@/components/ui/textarea");
const select_1 = require("@/components/ui/select");
const calendar_1 = require("@/components/ui/calendar");
const popover_1 = require("@/components/ui/popover");
const date_fns_1 = require("date-fns");
const lucide_react_1 = require("lucide-react");
const utils_1 = require("@/lib/utils");
function EditReservationForm({ reservation, tables }) {
    const { updateReservation } = (0, ReservationContext_1.useReservation)();
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const [date, setDate] = (0, react_1.useState)(new Date(reservation.date));
    const reservationTime = new Date(reservation.time);
    const initialTimeString = `${reservationTime.getHours().toString().padStart(2, "0")}:${reservationTime.getMinutes().toString().padStart(2, "0")}`;
    const [time, setTime] = (0, react_1.useState)(initialTimeString);
    const [formData, setFormData] = (0, react_1.useState)({
        id: reservation.id,
        customerName: reservation.customerName,
        phone: reservation.phone || "",
        email: reservation.email || "",
        partySize: reservation.partySize,
        tableId: reservation.tableId,
        status: reservation.status,
        notes: reservation.notes || "",
    });
    const availableTables = tables.filter((table) => (table.status === "available" || table.id === reservation.tableId) && table.capacity >= formData.partySize);
    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(Object.assign(Object.assign({}, formData), { [name]: type === "number" ? Number.parseInt(value) : value }));
    };
    const handleSelectChange = (name, value) => {
        setFormData(Object.assign(Object.assign({}, formData), { [name]: value }));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // Combine date and time
            const [hours, minutes] = time.split(":").map(Number);
            const reservationDateTime = (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(new Date(date), hours), minutes);
            await updateReservation(Object.assign(Object.assign({}, formData), { date: date.toISOString(), time: reservationDateTime.toISOString(), updatedAt: new Date().toISOString() }));
        }
        catch (error) {
            console.error("Error updating reservation:", error);
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label_1.Label htmlFor="customerName">Customer Name</label_1.Label>
        <input_1.Input id="customerName" name="customerName" value={formData.customerName} onChange={handleChange} required/>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label_1.Label htmlFor="phone">Phone Number</label_1.Label>
          <input_1.Input id="phone" name="phone" value={formData.phone} onChange={handleChange}/>
        </div>

        <div className="space-y-2">
          <label_1.Label htmlFor="email">Email</label_1.Label>
          <input_1.Input id="email" name="email" type="email" value={formData.email} onChange={handleChange}/>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label_1.Label htmlFor="date">Date</label_1.Label>
          <popover_1.Popover>
            <popover_1.PopoverTrigger asChild>
              <button_1.Button variant="outline" className={(0, utils_1.cn)("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <lucide_react_1.CalendarIcon className="mr-2 h-4 w-4"/>
                {date ? (0, date_fns_1.format)(date, "PPP") : <span>Pick a date</span>}
              </button_1.Button>
            </popover_1.PopoverTrigger>
            <popover_1.PopoverContent className="w-auto p-0">
              <calendar_1.Calendar mode="single" selected={date} onSelect={(date) => date && setDate(date)} initialFocus/>
            </popover_1.PopoverContent>
          </popover_1.Popover>
        </div>

        <div className="space-y-2">
          <label_1.Label htmlFor="time">Time</label_1.Label>
          <select_1.Select value={time} onValueChange={(value) => setTime(value)}>
            <select_1.SelectTrigger>
              <select_1.SelectValue placeholder="Select time"/>
            </select_1.SelectTrigger>
            <select_1.SelectContent>
              {Array.from({ length: 28 }, (_, i) => {
            const hour = Math.floor(i / 2) + 9; // Start at 9 AM
            const minute = (i % 2) * 30;
            const formattedHour = hour.toString().padStart(2, "0");
            const formattedMinute = minute.toString().padStart(2, "0");
            const timeValue = `${formattedHour}:${formattedMinute}`;
            const displayTime = (0, date_fns_1.format)((0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(new Date(), hour), minute), "h:mm a");
            return (<select_1.SelectItem key={timeValue} value={timeValue}>
                    {displayTime}
                  </select_1.SelectItem>);
        })}
            </select_1.SelectContent>
          </select_1.Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label_1.Label htmlFor="partySize">Party Size</label_1.Label>
          <input_1.Input id="partySize" name="partySize" type="number" min="1" value={formData.partySize} onChange={handleChange} required/>
        </div>

        <div className="space-y-2">
          <label_1.Label htmlFor="tableId">Table</label_1.Label>
          <select_1.Select value={formData.tableId} onValueChange={(value) => handleSelectChange("tableId", value)}>
            <select_1.SelectTrigger>
              <select_1.SelectValue placeholder="Select table"/>
            </select_1.SelectTrigger>
            <select_1.SelectContent>
              {availableTables.length > 0 ? (availableTables.map((table) => (<select_1.SelectItem key={table.id} value={table.id}>
                    Table {table.number} (Seats {table.capacity})
                  </select_1.SelectItem>))) : (<select_1.SelectItem value="none" disabled>
                  No suitable tables available
                </select_1.SelectItem>)}
            </select_1.SelectContent>
          </select_1.Select>
        </div>
      </div>

      <div className="space-y-2">
        <label_1.Label htmlFor="status">Status</label_1.Label>
        <select_1.Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
          <select_1.SelectTrigger>
            <select_1.SelectValue placeholder="Select status"/>
          </select_1.SelectTrigger>
          <select_1.SelectContent>
            <select_1.SelectItem value="confirmed">Confirmed</select_1.SelectItem>
            <select_1.SelectItem value="pending">Pending</select_1.SelectItem>
            <select_1.SelectItem value="cancelled">Cancelled</select_1.SelectItem>
            <select_1.SelectItem value="completed">Completed</select_1.SelectItem>
          </select_1.SelectContent>
        </select_1.Select>
      </div>

      <div className="space-y-2">
        <label_1.Label htmlFor="notes">Notes</label_1.Label>
        <textarea_1.Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} rows={3}/>
      </div>

      <button_1.Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (<>
            <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
            Updating...
          </>) : ("Update Reservation")}
      </button_1.Button>
    </form>);
}
