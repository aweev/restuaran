"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloorPlanEditor = FloorPlanEditor;
const react_1 = require("react");
const TableContext_1 = require("@/context/TableContext");
const button_1 = require("@/components/ui/button");
const table_card_1 = require("@/components/tables/table-card");
const table_details_dialog_1 = require("@/components/tables/table-details-dialog");
const table_transfer_dialog_1 = require("@/components/tables/table-transfer-dialog");
const table_merge_dialog_1 = require("@/components/tables/table-merge-dialog");
const lucide_react_1 = require("lucide-react");
const use_toast_1 = require("@/components/ui/use-toast");
function FloorPlanEditor({ tables }) {
    const { updateTablePosition, selectTable } = (0, TableContext_1.useTable)();
    const [selectedTable, setSelectedTable] = (0, react_1.useState)(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = (0, react_1.useState)(false);
    const [isTransferDialogOpen, setIsTransferDialogOpen] = (0, react_1.useState)(false);
    const [isMergeDialogOpen, setIsMergeDialogOpen] = (0, react_1.useState)(false);
    const [isEditMode, setIsEditMode] = (0, react_1.useState)(false);
    const [tablePositions, setTablePositions] = (0, react_1.useState)({});
    const [history, setHistory] = (0, react_1.useState)([]);
    const [historyIndex, setHistoryIndex] = (0, react_1.useState)(-1);
    const floorPlanRef = (0, react_1.useRef)(null);
    const draggedTableRef = (0, react_1.useRef)(null);
    const startPositionRef = (0, react_1.useRef)(null);
    // Initialize table positions
    (0, react_1.useEffect)(() => {
        const positions = {};
        tables.forEach((table) => {
            positions[table.id] = { x: table.position.x, y: table.position.y };
        });
        setTablePositions(positions);
        // Initialize history with current positions
        setHistory([positions]);
        setHistoryIndex(0);
    }, [tables]);
    const handleTableClick = (table) => {
        if (isEditMode)
            return;
        setSelectedTable(table);
        selectTable(table);
        setIsDetailsDialogOpen(true);
    };
    const handleCloseDetailsDialog = () => {
        setIsDetailsDialogOpen(false);
        setTimeout(() => {
            setSelectedTable(null);
            selectTable(null);
        }, 300);
    };
    const handleDragStart = (e, tableId) => {
        if (!isEditMode)
            return;
        e.preventDefault();
        draggedTableRef.current = tableId;
        const table = document.getElementById(`table-${tableId}`);
        if (table) {
            const rect = table.getBoundingClientRect();
            startPositionRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }
    };
    const handleDragMove = (e) => {
        if (!isEditMode || !draggedTableRef.current || !startPositionRef.current || !floorPlanRef.current)
            return;
        const floorPlanRect = floorPlanRef.current.getBoundingClientRect();
        const newX = e.clientX - floorPlanRect.left - startPositionRef.current.x;
        const newY = e.clientY - floorPlanRect.top - startPositionRef.current.y;
        // Ensure table stays within floor plan boundaries
        const boundedX = Math.max(0, Math.min(newX, floorPlanRect.width - 80));
        const boundedY = Math.max(0, Math.min(newY, floorPlanRect.height - 80));
        setTablePositions((prev) => (Object.assign(Object.assign({}, prev), { [draggedTableRef.current]: { x: boundedX, y: boundedY } })));
    };
    const handleDragEnd = () => {
        if (!isEditMode || !draggedTableRef.current)
            return;
        // Add current positions to history
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(Object.assign({}, tablePositions));
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        draggedTableRef.current = null;
        startPositionRef.current = null;
    };
    const handleUndo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setTablePositions(Object.assign({}, history[historyIndex - 1]));
        }
    };
    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setTablePositions(Object.assign({}, history[historyIndex + 1]));
        }
    };
    const handleSavePositions = async () => {
        try {
            // Save all table positions to the database
            const savePromises = Object.entries(tablePositions).map(([tableId, position]) => updateTablePosition(tableId, position));
            await Promise.all(savePromises);
            (0, use_toast_1.toast)({
                title: "Floor plan saved",
                description: "Table positions have been updated successfully.",
            });
            setIsEditMode(false);
        }
        catch (error) {
            console.error("Error saving table positions:", error);
            (0, use_toast_1.toast)({
                title: "Error saving floor plan",
                description: "There was a problem updating table positions.",
                variant: "destructive",
            });
        }
    };
    return (<div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button_1.Button variant={isEditMode ? "default" : "outline"} onClick={() => setIsEditMode(!isEditMode)}>
            <lucide_react_1.Move className="mr-2 h-4 w-4"/>
            {isEditMode ? "Exit Edit Mode" : "Edit Floor Plan"}
          </button_1.Button>

          {isEditMode && (<>
              <button_1.Button variant="outline" onClick={handleUndo} disabled={historyIndex <= 0}>
                <lucide_react_1.Undo className="h-4 w-4"/>
              </button_1.Button>
              <button_1.Button variant="outline" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
                <lucide_react_1.Redo className="h-4 w-4"/>
              </button_1.Button>
              <button_1.Button onClick={handleSavePositions}>
                <lucide_react_1.Save className="mr-2 h-4 w-4"/>
                Save Layout
              </button_1.Button>
            </>)}
        </div>

        {selectedTable && !isEditMode && (<div className="flex space-x-2">
            <button_1.Button variant="outline" onClick={() => setIsTransferDialogOpen(true)}>
              Transfer Table
            </button_1.Button>
            <button_1.Button variant="outline" onClick={() => setIsMergeDialogOpen(true)}>
              Merge Tables
            </button_1.Button>
          </div>)}
      </div>

      <div ref={floorPlanRef} className="relative h-[600px] w-full rounded-lg border bg-gray-50 p-4" onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}>
        {/* Background grid for visual reference */}
        <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-4 opacity-10">
          {Array.from({ length: 72 }).map((_, i) => (<div key={i} className="border border-dashed border-gray-400"></div>))}
        </div>

        {/* Tables */}
        {tables.map((table) => {
            var _a, _b;
            return (<div id={`table-${table.id}`} key={table.id} className={`absolute cursor-${isEditMode ? "move" : "pointer"} transition-all duration-200 ${draggedTableRef.current === table.id ? "z-10 scale-105" : ""}`} style={{
                    left: `${((_a = tablePositions[table.id]) === null || _a === void 0 ? void 0 : _a.x) || table.position.x}px`,
                    top: `${((_b = tablePositions[table.id]) === null || _b === void 0 ? void 0 : _b.y) || table.position.y}px`,
                }} onClick={() => handleTableClick(table)} onMouseDown={(e) => handleDragStart(e, table.id)}>
            <table_card_1.TableCard table={table}/>
          </div>);
        })}
      </div>

      {/* Dialogs */}
      <table_details_dialog_1.TableDetailsDialog table={selectedTable} open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen} onClose={handleCloseDetailsDialog}/>

      <table_transfer_dialog_1.TableTransferDialog table={selectedTable} open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen} tables={tables.filter((t) => t.id !== (selectedTable === null || selectedTable === void 0 ? void 0 : selectedTable.id))}/>

      <table_merge_dialog_1.TableMergeDialog table={selectedTable} open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen} tables={tables.filter((t) => t.id !== (selectedTable === null || selectedTable === void 0 ? void 0 : selectedTable.id))}/>
    </div>);
}
