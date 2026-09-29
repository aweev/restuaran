"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableStatusOverview = TableStatusOverview;
const card_1 = require("@/components/ui/card");
function TableStatusOverview({ tables }) {
    // Count tables by status
    const availableTables = tables.filter((table) => table.status === "available").length;
    const occupiedTables = tables.filter((table) => table.status === "occupied").length;
    const reservedTables = tables.filter((table) => table.status === "reserved").length;
    const dirtyTables = tables.filter((table) => table.status === "dirty").length;
    // Calculate total capacity
    const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
    // Calculate occupied capacity
    const occupiedCapacity = tables
        .filter((table) => table.status === "occupied")
        .reduce((sum, table) => sum + (table.customerCount || 0), 0);
    // Calculate utilization percentage
    const utilizationPercentage = tables.length > 0 ? Math.round((occupiedTables / tables.length) * 100) : 0;
    // Calculate capacity utilization percentage
    const capacityUtilizationPercentage = totalCapacity > 0 ? Math.round((occupiedCapacity / totalCapacity) * 100) : 0;
    return (<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
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

      <card_1.Card>
        <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <card_1.CardTitle className="text-sm font-medium">Table Utilization</card_1.CardTitle>
        </card_1.CardHeader>
        <card_1.CardContent>
          <div className="text-2xl font-bold">{utilizationPercentage}%</div>
          <p className="text-xs text-muted-foreground">
            {occupiedTables} of {tables.length} tables
          </p>
        </card_1.CardContent>
      </card_1.Card>

      <card_1.Card>
        <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <card_1.CardTitle className="text-sm font-medium">Capacity Utilization</card_1.CardTitle>
        </card_1.CardHeader>
        <card_1.CardContent>
          <div className="text-2xl font-bold">{capacityUtilizationPercentage}%</div>
          <p className="text-xs text-muted-foreground">
            {occupiedCapacity} of {totalCapacity} seats
          </p>
        </card_1.CardContent>
      </card_1.Card>
    </div>);
}
