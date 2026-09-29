"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableGrid = TableGrid;
const react_1 = require("react");
const TableContext_1 = require("@/context/TableContext");
const button_1 = require("@/components/ui/button");
const table_card_1 = require("@/components/tables/table-card");
const table_details_dialog_1 = require("@/components/tables/table-details-dialog");
function TableGrid({ tables }) {
    const { selectTable } = (0, TableContext_1.useTable)();
    const [selectedTable, setSelectedTable] = (0, react_1.useState)(null);
    const [isDialogOpen, setIsDialogOpen] = (0, react_1.useState)(false);
    const handleTableClick = (table) => {
        setSelectedTable(table);
        selectTable(table);
        setIsDialogOpen(true);
    };
    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setTimeout(() => {
            setSelectedTable(null);
            selectTable(null);
        }, 300);
    };
    return (<div className="relative min-h-[500px] w-full bg-gray-50 rounded-lg p-4">
      {tables.map((table) => (<div key={table.id} style={{
                position: "absolute",
                left: `${table.position.x}px`,
                top: `${table.position.y}px`,
            }}>
          <button_1.Button variant="outline" className="h-auto p-0" onClick={() => handleTableClick(table)}>
            <table_card_1.TableCard table={table}/>
          </button_1.Button>
        </div>))}

      <table_details_dialog_1.TableDetailsDialog table={selectedTable} open={isDialogOpen} onOpenChange={setIsDialogOpen} onClose={handleCloseDialog}/>
    </div>);
}
