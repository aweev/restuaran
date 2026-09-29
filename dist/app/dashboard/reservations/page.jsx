"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReservationsPage;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const tabs_1 = require("@/components/ui/tabs");
const button_1 = require("@/components/ui/button");
const calendar_1 = require("@/components/ui/calendar");
const ReservationContext_1 = require("@/context/ReservationContext");
const TableContext_1 = require("@/context/TableContext");
const reservation_list_1 = require("@/components/reservations/reservation-list");
const reservation_calendar_1 = require("@/components/reservations/reservation-calendar");
const lucide_react_1 = require("lucide-react");
const lucide_react_2 = require("lucide-react");
const dialog_1 = require("@/components/ui/dialog");
const add_reservation_form_1 = require("@/components/reservations/add-reservation-form");
const date_fns_1 = require("date-fns");
function ReservationsPage() {
    const { state: reservationState, fetchReservations } = (0, ReservationContext_1.useReservation)();
    const { state: tableState, fetchTables } = (0, TableContext_1.useTable)();
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [selectedDate, setSelectedDate] = (0, react_1.useState)(new Date());
    (0, react_1.useEffect)(() => {
        const loadData = async () => {
            try {
                await Promise.all([fetchReservations(), fetchTables()]);
            }
            catch (error) {
                console.error("Error loading reservation data:", error);
            }
            finally {
                setLoading(false);
            }
        };
        loadData();
    }, [fetchReservations, fetchTables]);
    // Filter reservations for the selected date
    const filteredReservations = reservationState.reservations.filter((reservation) => {
        const reservationDate = new Date(reservation.date);
        return (reservationDate.getDate() === selectedDate.getDate() &&
            reservationDate.getMonth() === selectedDate.getMonth() &&
            reservationDate.getFullYear() === selectedDate.getFullYear());
    });
    // Count today's reservations
    const today = new Date();
    const todayReservations = reservationState.reservations.filter((reservation) => {
        const reservationDate = new Date(reservation.date);
        return (reservationDate.getDate() === today.getDate() &&
            reservationDate.getMonth() === today.getMonth() &&
            reservationDate.getFullYear() === today.getFullYear());
    });
    // Count upcoming reservations (future dates)
    const upcomingReservations = reservationState.reservations.filter((reservation) => {
        const reservationDate = new Date(reservation.date);
        return reservationDate > today;
    });
    if (loading) {
        return (<div className="flex h-full items-center justify-center">
        <lucide_react_2.Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </div>);
    }
    return (<div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Reservations</h2>
        <dialog_1.Dialog>
          <dialog_1.DialogTrigger asChild>
            <button_1.Button>
              <lucide_react_1.Plus className="mr-2 h-4 w-4"/>
              New Reservation
            </button_1.Button>
          </dialog_1.DialogTrigger>
          <dialog_1.DialogContent className="sm:max-w-[500px]">
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle>Add New Reservation</dialog_1.DialogTitle>
            </dialog_1.DialogHeader>
            <add_reservation_form_1.AddReservationForm tables={tableState.tables}/>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Today&apos;s Reservations</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{todayReservations.length}</div>
            <p className="text-xs text-muted-foreground">{(0, date_fns_1.format)(today, "MMMM d, yyyy")}</p>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Upcoming Reservations</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{upcomingReservations.length}</div>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Available Tables</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">
              {tableState.tables.filter((t) => t.status === "available").length} / {tableState.tables.length}
            </div>
            <p className="text-xs text-muted-foreground">For current time slot</p>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Selected Date</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{(0, date_fns_1.format)(selectedDate, "MMM d")}</div>
            <p className="text-xs text-muted-foreground">{filteredReservations.length} reservations</p>
          </card_1.CardContent>
        </card_1.Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <card_1.Card className="md:col-span-1">
          <card_1.CardHeader>
            <card_1.CardTitle>Select Date</card_1.CardTitle>
            <card_1.CardDescription>Choose a date to view reservations</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <calendar_1.Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} className="rounded-md border"/>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card className="md:col-span-2">
          <card_1.CardHeader>
            <card_1.CardTitle>Reservations for {(0, date_fns_1.format)(selectedDate, "MMMM d, yyyy")}</card_1.CardTitle>
            <card_1.CardDescription>{filteredReservations.length} reservations scheduled</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <tabs_1.Tabs defaultValue="list" className="space-y-4">
              <tabs_1.TabsList>
                <tabs_1.TabsTrigger value="list">List View</tabs_1.TabsTrigger>
                <tabs_1.TabsTrigger value="calendar">Time Slots</tabs_1.TabsTrigger>
              </tabs_1.TabsList>
              <tabs_1.TabsContent value="list">
                <reservation_list_1.ReservationList reservations={filteredReservations} tables={tableState.tables}/>
              </tabs_1.TabsContent>
              <tabs_1.TabsContent value="calendar">
                <reservation_calendar_1.ReservationCalendar reservations={filteredReservations} tables={tableState.tables} date={selectedDate}/>
              </tabs_1.TabsContent>
            </tabs_1.Tabs>
          </card_1.CardContent>
        </card_1.Card>
      </div>
    </div>);
}
