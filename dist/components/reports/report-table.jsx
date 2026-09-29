"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportTable = ReportTable;
const react_1 = require("react");
const date_fns_1 = require("date-fns");
const table_1 = require("@/components/ui/table");
const react_table_1 = require("@tanstack/react-table");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const lucide_react_1 = require("lucide-react");
function ReportTable({ orders }) {
    var _a;
    const [sorting, setSorting] = (0, react_1.useState)([]);
    const [globalFilter, setGlobalFilter] = (0, react_1.useState)("");
    const columns = [
        {
            accessorKey: "id",
            header: "Order ID",
            cell: ({ row }) => <div className="font-medium">{row.original.id.slice(0, 8)}</div>,
        },
        {
            accessorKey: "createdAt",
            header: ({ column }) => {
                return (<button_1.Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Date
            {column.getIsSorted() === "asc" ? (<lucide_react_1.ChevronUp className="ml-2 h-4 w-4"/>) : column.getIsSorted() === "desc" ? (<lucide_react_1.ChevronDown className="ml-2 h-4 w-4"/>) : null}
          </button_1.Button>);
            },
            cell: ({ row }) => (0, date_fns_1.format)(new Date(row.original.createdAt), "MMM dd, yyyy HH:mm"),
            sortingFn: "datetime",
        },
        {
            accessorKey: "customerName",
            header: "Customer",
            cell: ({ row }) => row.original.customerName || "N/A",
        },
        {
            accessorKey: "diningMode",
            header: "Type",
            cell: ({ row }) => row.original.diningMode,
        },
        {
            accessorKey: "items",
            header: "Items",
            cell: ({ row }) => row.original.items.length,
        },
        {
            accessorKey: "subtotal",
            header: ({ column }) => {
                return (<button_1.Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Subtotal
            {column.getIsSorted() === "asc" ? (<lucide_react_1.ChevronUp className="ml-2 h-4 w-4"/>) : column.getIsSorted() === "desc" ? (<lucide_react_1.ChevronDown className="ml-2 h-4 w-4"/>) : null}
          </button_1.Button>);
            },
            cell: ({ row }) => `$${row.original.subtotal.toFixed(2)}`,
        },
        {
            accessorKey: "total",
            header: ({ column }) => {
                return (<button_1.Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Total
            {column.getIsSorted() === "asc" ? (<lucide_react_1.ChevronUp className="ml-2 h-4 w-4"/>) : column.getIsSorted() === "desc" ? (<lucide_react_1.ChevronDown className="ml-2 h-4 w-4"/>) : null}
          </button_1.Button>);
            },
            cell: ({ row }) => <div className="font-medium">${row.original.total.toFixed(2)}</div>,
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => <div className="capitalize">{row.original.status}</div>,
        },
    ];
    const table = (0, react_table_1.useReactTable)({
        data: orders,
        columns,
        state: {
            sorting,
            globalFilter,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: (0, react_table_1.getCoreRowModel)(),
        getPaginationRowModel: (0, react_table_1.getPaginationRowModel)(),
        getSortedRowModel: (0, react_table_1.getSortedRowModel)(),
    });
    return (<div className="space-y-4">
      <div className="flex items-center">
        <input_1.Input placeholder="Search orders..." value={globalFilter !== null && globalFilter !== void 0 ? globalFilter : ""} onChange={(e) => setGlobalFilter(e.target.value)} className="max-w-sm"/>
      </div>
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
                  No results.
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
