"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationCalendar = ReservationCalendar;
const react_1 = require("react");
const date_fns_1 = require("date-fns");
const badge_1 = require("@/components/ui/badge");
const scroll_area_1 = require("@/components/ui/scroll-area");
function ReservationCalendar({ reservations, tables, date }) {
    // Generate time slots from 9 AM to 10 PM in 30-minute intervals
    const timeSlots = (0, react_1.useMemo)(() => {
        const slots = [];
        const startTime = (0, date_fns_1.setHours)((0, date_fns_1.setMinutes)(new Date(date), 0), 9); // 9:00 AM
        const endTime = (0, date_fns_1.setHours)((0, date_fns_1.setMinutes)(new Date(date), 0), 22); // 10:00 PM
        let currentTime = startTime;
        while ((0, date_fns_1.isBefore)(currentTime, endTime)) {
            slots.push({
                time: new Date(currentTime),
                label: (0, date_fns_1.format)(currentTime, "h:mm a"),
            });
            currentTime = (0, date_fns_1.addMinutes)(currentTime, 30);
        }
        return slots;
    }, [date]);
    // Group reservations by time slot
    const reservationsByTimeSlot = (0, react_1.useMemo)(() => {
        const grouped = new Map();
        timeSlots.forEach((slot) => {
            const slotStart = slot.time;
            const slotEnd = (0, date_fns_1.addMinutes)(slot.time, 30);
            const slotReservations = reservations.filter((reservation) => {
                const reservationTime = new Date(reservation.time);
                return (0, date_fns_1.isAfter)(reservationTime, slotStart) && (0, date_fns_1.isBefore)(reservationTime, slotEnd);
            });
            grouped.set(slot.label, slotReservations);
        });
        return grouped;
    }, [reservations, timeSlots]);
    return (<scroll_area_1.ScrollArea className="h-[500px] pr-4">
      <div className="space-y-1">
        {timeSlots.map((slot) => {
            const slotReservations = reservationsByTimeSlot.get(slot.label) || [];
            return (<div key={slot.label} className="grid grid-cols-[100px_1fr] gap-2">
              <div className="py-2 font-medium">{slot.label}</div>
              <div className="flex flex-wrap gap-2 py-2">
                {slotReservations.length > 0 ? (slotReservations.map((reservation) => {
                    const table = tables.find((t) => t.id === reservation.tableId);
                    return (<div key={reservation.id} className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
                        <badge_1.Badge variant="outline">Table {(table === null || table === void 0 ? void 0 : table.number) || "?"}</badge_1.Badge>
                        <span>{reservation.customerName}</span>
                        <span className="text-muted-foreground">({reservation.partySize} guests)</span>
                      </div>);
                })) : (<div className="flex h-10 items-center text-sm text-muted-foreground">Available</div>)}
              </div>
            </div>);
        })}
      </div>
    </scroll_area_1.ScrollArea>);
}
