"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TableManagementPage;
const react_1 = require("react");
const TableContext_1 = require("@/context/TableContext");
const ReservationContext_1 = require("@/context/ReservationContext");
const tabs_1 = require("@/components/ui/tabs");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
const floor_plan_editor_1 = require("@/components/tables/floor-plan-editor");
const table_status_overview_1 = require("@/components/tables/table-status-overview");
const reservation_calendar_1 = require("@/components/reservations/reservation-calendar");
const wait_list_manager_1 = require("@/components/tables/wait-list-manager");
const table_service_tracker_1 = require("@/components/tables/table-service-tracker");
const customer_preferences_1 = require("@/components/tables/customer-preferences");
const table_action_dialog_1 = require("@/components/tables/table-action-dialog");
function TableManagementPage() {
    const { state: tableState, fetchTables } = (0, TableContext_1.useTable)();
    const { state: reservationState, fetchReservations } = (0, ReservationContext_1.useReservation)();
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [showTableActionDialog, setShowTableActionDialog] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        const loadData = async () => {
            try {
                await Promise.all([fetchTables(), fetchReservations()]);
            }
            catch (error) {
                console.error("Error loading table management data:", error);
            }
            finally {
                setLoading(false);
            }
        };
        loadData();
    }, [fetchTables, fetchReservations]);
    if (loading) {
        return (<div className="flex h-full items-center justify-center">
        <lucide_react_1.Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </div>);
    }
    return (<div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Table Management</h2>
        <button_1.Button onClick={() => setShowTableActionDialog(true)}>
          <lucide_react_1.Plus className="mr-2 h-4 w-4"/> Add Table
        </button_1.Button>
      </div>

      <table_status_overview_1.TableStatusOverview tables={tableState.tables}/>

      <tabs_1.Tabs defaultValue="floor-plan" className="w-full">
        <tabs_1.TabsList className="grid w-full grid-cols-5">
          <tabs_1.TabsTrigger value="floor-plan">Floor Plan</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="reservations">Reservations</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="wait-list">Wait List</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="service">Service Timing</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="customers">Customer Profiles</tabs_1.TabsTrigger>
        </tabs_1.TabsList>

        <tabs_1.TabsContent value="floor-plan" className="mt-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Restaurant Floor Plan</card_1.CardTitle>
              <card_1.CardDescription>
                Drag tables to rearrange. Click on a table to view details or take actions.
              </card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent>
              <floor_plan_editor_1.FloorPlanEditor tables={tableState.tables}/>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>

        <tabs_1.TabsContent value="reservations" className="mt-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Reservations</card_1.CardTitle>
              <card_1.CardDescription>Manage upcoming reservations and table assignments.</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent>
              <reservation_calendar_1.ReservationCalendar reservations={reservationState.reservations} tables={tableState.tables} date={new Date()}/>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>

        <tabs_1.TabsContent value="wait-list" className="mt-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Wait List</card_1.CardTitle>
              <card_1.CardDescription>Manage customers waiting for tables.</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent>
              <wait_list_manager_1.WaitListManager tables={tableState.tables}/>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>

        <tabs_1.TabsContent value="service" className="mt-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Service Timing</card_1.CardTitle>
              <card_1.CardDescription>Track service timing for occupied tables.</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent>
              <table_service_tracker_1.TableServiceTracker tables={tableState.tables}/>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>

        <tabs_1.TabsContent value="customers" className="mt-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Customer Profiles</card_1.CardTitle>
              <card_1.CardDescription>View and manage customer preferences and history.</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent>
              <customer_preferences_1.CustomerPreferences />
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>
      </tabs_1.Tabs>

      <table_action_dialog_1.TableActionDialog open={showTableActionDialog} onOpenChange={setShowTableActionDialog}/>
    </div>);
}
