"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TablesPage;
const react_1 = require("react");
const TableContext_1 = require("@/context/TableContext");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const table_grid_1 = require("@/components/tables/table-grid");
const lucide_react_1 = require("lucide-react");
function TablesPage() {
    const { state, fetchTables } = (0, TableContext_1.useTable)();
    const [loading, setLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        const loadData = async () => {
            try {
                await fetchTables();
            }
            catch (error) {
                console.error("Error loading tables data:", error);
            }
            finally {
                setLoading(false);
            }
        };
        loadData();
    }, [fetchTables]);
    if (loading) {
        return (<div className="flex h-full items-center justify-center">
        <lucide_react_1.Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </div>);
    }
    // Count tables by status
    const availableTables = state.tables.filter((table) => table.status === "available").length;
    const occupiedTables = state.tables.filter((table) => table.status === "occupied").length;
    const reservedTables = state.tables.filter((table) => table.status === "reserved").length;
    const dirtyTables = state.tables.filter((table) => table.status === "dirty").length;
    return (<div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Tables</h2>
        <button_1.Button>
          <lucide_react_1.Plus className="mr-2 h-4 w-4"/> Add Table
        </button_1.Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Available</card_1.CardTitle>
            <div className="h-4 w-4 rounded-full bg-green-500"></div>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{availableTables}</div>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Occupied</card_1.CardTitle>
            <div className="h-4 w-4 rounded-full bg-red-500"></div>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{occupiedTables}</div>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Reserved</card_1.CardTitle>
            <div className="h-4 w-4 rounded-full bg-blue-500"></div>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{reservedTables}</div>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Needs Cleaning</card_1.CardTitle>
            <div className="h-4 w-4 rounded-full bg-yellow-500"></div>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{dirtyTables}</div>
          </card_1.CardContent>
        </card_1.Card>
      </div>

      <card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle>Table Layout</card_1.CardTitle>
        </card_1.CardHeader>
        <card_1.CardContent>
          <table_grid_1.TableGrid tables={state.tables}/>
        </card_1.CardContent>
      </card_1.Card>
    </div>);
}
