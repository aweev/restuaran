"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationList = ReservationList;
const date_fns_1 = require("date-fns");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const dialog_1 = require("@/components/ui/dialog");
const edit_reservation_form_1 = require("@/components/reservations/edit-reservation-form");
const react_1 = require("react");
const ReservationContext_1 = require("@/context/ReservationContext");
const lucide_react_1 = require("lucide-react");
function ReservationList({ reservations, tables }) {
    const [selectedReservation, setSelectedReservation] = (0, react_1.useState)(null);
    const { cancelReservation } = (0, ReservationContext_1.useReservation)();
    const getTableById = (tableId) => {
        return tables.find((table) => table.id === tableId);
    };
    const getStatusColor = (status) => {
        switch (status) {
            case "confirmed":
                return "bg-green-100 text-green-800";
            case "pending":
                return "bg-yellow-100 text-yellow-800";
            case "cancelled":
                return "bg-red-100 text-red-800";
            case "completed":
                return "bg-blue-100 text-blue-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };
    const handleCancelReservation = async (id) => {
        if (confirm("Are you sure you want to cancel this reservation?")) {
            try {
                await cancelReservation(id);
            }
            catch (error) {
                console.error("Error cancelling reservation:", error);
            }
        }
    };
    if (reservations.length === 0) {
        return (<div className="flex h-40 items-center justify-center text-muted-foreground">No reservations for this date.</div>);
    }
    return (<div className="space-y-4">
      {reservations
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
            .map((reservation) => {
            const table = getTableById(reservation.tableId);
            return (<div key={reservation.id} className="flex flex-col rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{reservation.customerName}</h3>
                  <badge_1.Badge variant="outline" className={getStatusColor(reservation.status)}>
                    {reservation.status}
                  </badge_1.Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <lucide_react_1.Clock className="h-4 w-4"/>
                    <span>{(0, date_fns_1.format)(new Date(reservation.time), "h:mm a")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <lucide_react_1.Users className="h-4 w-4"/>
                    <span>{reservation.partySize} guests</span>
                  </div>
                  {table && (<div>
                      Table {table.number} (Capacity: {table.capacity})
                    </div>)}
                  {reservation.phone && (<div className="flex items-center gap-1">
                      <lucide_react_1.Phone className="h-4 w-4"/>
                      <span>{reservation.phone}</span>
                    </div>)}
                </div>
                {reservation.notes && <p className="text-sm text-muted-foreground">{reservation.notes}</p>}
              </div>
              <div className="mt-4 flex gap-2 sm:mt-0">
                <dialog_1.Dialog>
                  <dialog_1.DialogTrigger asChild>
                    <button_1.Button variant="ghost" size="icon" onClick={() => setSelectedReservation(reservation)}>
                      <lucide_react_1.Edit className="h-4 w-4"/>
                    </button_1.Button>
                  </dialog_1.DialogTrigger>
                  <dialog_1.DialogContent className="sm:max-w-[500px]">
                    <dialog_1.DialogHeader>
                      <dialog_1.DialogTitle>Edit Reservation</dialog_1.DialogTitle>
                    </dialog_1.DialogHeader>
                    {selectedReservation && <edit_reservation_form_1.EditReservationForm reservation={selectedReservation} tables={tables}/>}
                  </dialog_1.DialogContent>
                </dialog_1.Dialog>
                <button_1.Button variant="ghost" size="icon" onClick={() => handleCancelReservation(reservation.id)} disabled={reservation.status === "cancelled"}>
                  <lucide_react_1.Trash className="h-4 w-4"/>
                </button_1.Button>
              </div>
            </div>);
        })}
    </div>);
}
