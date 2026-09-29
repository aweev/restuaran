"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryTable = InventoryTable;
const react_1 = require("react");
const table_1 = require("@/components/ui/table");
const react_table_1 = require("@tanstack/react-table");
const button_1 = require("@/components/ui/button");
const badge_1 = require("@/components/ui/badge");
const lucide_react_1 = require("lucide-react");
const InventoryContext_1 = require("@/context/InventoryContext");
const dialog_1 = require("@/components/ui/dialog");
const edit_ingredient_form_1 = require("@/components/inventory/edit-ingredient-form");
function InventoryTable({ ingredients }) {
    var _a;
    const [sorting, setSorting] = (0, react_1.useState)([]);
    const [selectedIngredient, setSelectedIngredient] = (0, react_1.useState)(null);
    const { updateIngredientStock, deleteIngredient } = (0, InventoryContext_1.useInventory)();
    const columns = [
        {
            accessorKey: "name",
            header: ({ column }) => {
                return (<button_1.Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Name
            {column.getIsSorted() === "asc" ? (<lucide_react_1.ChevronUp className="ml-2 h-4 w-4"/>) : column.getIsSorted() === "desc" ? (<lucide_react_1.ChevronDown className="ml-2 h-4 w-4"/>) : null}
          </button_1.Button>);
            },
            cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
        },
        {
            accessorKey: "category",
            header: "Category",
            cell: ({ row }) => <div>{row.original.category}</div>,
        },
        {
            accessorKey: "unit",
            header: "Unit",
            cell: ({ row }) => <div>{row.original.unit}</div>,
        },
        {
            accessorKey: "currentStock",
            header: ({ column }) => {
                return (<button_1.Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Current Stock
            {column.getIsSorted() === "asc" ? (<lucide_react_1.ChevronUp className="ml-2 h-4 w-4"/>) : column.getIsSorted() === "desc" ? (<lucide_react_1.ChevronDown className="ml-2 h-4 w-4"/>) : null}
          </button_1.Button>);
            },
            cell: ({ row }) => {
                const ingredient = row.original;
                const stockStatus = ingredient.currentStock <= ingredient.reorderLevel
                    ? "low"
                    : ingredient.currentStock <= ingredient.reorderLevel * 2
                        ? "medium"
                        : "good";
                return (<div className="flex items-center gap-2">
            <span>
              {ingredient.currentStock} {ingredient.unit}
            </span>
            <badge_1.Badge variant="outline" className={stockStatus === "low"
                        ? "bg-red-100 text-red-800"
                        : stockStatus === "medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"}>
              {stockStatus === "low" ? "Low" : stockStatus === "medium" ? "Medium" : "Good"}
            </badge_1.Badge>
          </div>);
            },
        },
        {
            accessorKey: "reorderLevel",
            header: "Reorder Level",
            cell: ({ row }) => (<div>
          {row.original.reorderLevel} {row.original.unit}
        </div>),
        },
        {
            accessorKey: "unitCost",
            header: ({ column }) => {
                return (<button_1.Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Unit Cost
            {column.getIsSorted() === "asc" ? (<lucide_react_1.ChevronUp className="ml-2 h-4 w-4"/>) : column.getIsSorted() === "desc" ? (<lucide_react_1.ChevronDown className="ml-2 h-4 w-4"/>) : null}
          </button_1.Button>);
            },
            cell: ({ row }) => <div>${row.original.unitCost.toFixed(2)}</div>,
        },
        {
            accessorKey: "totalValue",
            header: ({ column }) => {
                return (<button_1.Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Total Value
            {column.getIsSorted() === "asc" ? (<lucide_react_1.ChevronUp className="ml-2 h-4 w-4"/>) : column.getIsSorted() === "desc" ? (<lucide_react_1.ChevronDown className="ml-2 h-4 w-4"/>) : null}
          </button_1.Button>);
            },
            cell: ({ row }) => {
                const totalValue = row.original.currentStock * row.original.unitCost;
                return <div className="font-medium">${totalValue.toFixed(2)}</div>;
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                return (<div className="flex items-center gap-2">
            <dialog_1.Dialog>
              <dialog_1.DialogTrigger asChild>
                <button_1.Button variant="ghost" size="icon" onClick={() => setSelectedIngredient(row.original)}>
                  <lucide_react_1.Edit className="h-4 w-4"/>
                </button_1.Button>
              </dialog_1.DialogTrigger>
              <dialog_1.DialogContent className="sm:max-w-[425px]">
                <dialog_1.DialogHeader>
                  <dialog_1.DialogTitle>Edit Ingredient</dialog_1.DialogTitle>
                </dialog_1.DialogHeader>
                {selectedIngredient && <edit_ingredient_form_1.EditIngredientForm ingredient={selectedIngredient}/>}
              </dialog_1.DialogContent>
            </dialog_1.Dialog>
            <button_1.Button variant="ghost" size="icon" onClick={() => {
                        if (confirm("Are you sure you want to delete this ingredient?")) {
                            deleteIngredient(row.original.id);
                        }
                    }}>
              <lucide_react_1.Trash className="h-4 w-4"/>
            </button_1.Button>
          </div>);
            },
        },
    ];
    const table = (0, react_table_1.useReactTable)({
        data: ingredients,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: (0, react_table_1.getCoreRowModel)(),
        getPaginationRowModel: (0, react_table_1.getPaginationRowModel)(),
        getSortedRowModel: (0, react_table_1.getSortedRowModel)(),
    });
    return (<div className="space-y-4">
      <div className="rounded-md border">
        <table_1.Table>
          <table_1.TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (<table_1.TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (<table_1.TableHead key={header.id}>
                    {header.isPlaceholder ? null : (0, react_table_1.flexRender)(header.column.columnDef.header, header.getContext())}
                  </table_1.TableHead>))}
              </table_1.TableRow>))}
          </table_1.TableHeader>
          <table_1.TableBody>
            {((_a = table.getRowModel().rows) === null || _a === void 0 ? void 0 : _a.length) ? (table.getRowModel().rows.map((row) => (<table_1.TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (<table_1.TableCell key={cell.id}>{(0, react_table_1.flexRender)(cell.column.columnDef.cell, cell.getContext())}</table_1.TableCell>))}
                </table_1.TableRow>))) : (<table_1.TableRow>
                <table_1.TableCell colSpan={columns.length} className="h-24 text-center">
                  No ingredients found.
                </table_1.TableCell>
              </table_1.TableRow>)}
          </table_1.TableBody>
        </table_1.Table>
      </div>
      <div className="flex items-center justify-end space-x-2">
        <button_1.Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </button_1.Button>
        <button_1.Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </button_1.Button>
      </div>
    </div>);
}
