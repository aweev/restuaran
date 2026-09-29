"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DragDropOrderManager = DragDropOrderManager;
const react_1 = require("react");
const dnd_1 = require("@hello-pangea/dnd");
const lucide_react_1 = require("lucide-react");
const card_1 = require("@/components/ui/card");
const badge_1 = require("@/components/ui/badge");
const utils_1 = require("@/lib/utils");
const OrderContext_1 = require("@/context/OrderContext");
function DragDropOrderManager() {
    const { orders, updateOrderStatus } = (0, OrderContext_1.useOrder)();
    // Group orders by status
    const initialColumns = [
        {
            id: "pending",
            title: "Pending",
            icon: lucide_react_1.Clock,
            orders: orders.filter((order) => order.status === "pending"),
        },
        {
            id: "preparing",
            title: "Preparing",
            icon: lucide_react_1.ChefHat,
            orders: orders.filter((order) => order.status === "preparing"),
        },
        {
            id: "ready",
            title: "Ready",
            icon: lucide_react_1.CheckCircle,
            orders: orders.filter((order) => order.status === "ready"),
        },
        {
            id: "delivered",
            title: "Delivered",
            icon: lucide_react_1.Truck,
            orders: orders.filter((order) => order.status === "delivered"),
        },
        {
            id: "cancelled",
            title: "Cancelled",
            icon: lucide_react_1.AlertCircle,
            orders: orders.filter((order) => order.status === "cancelled"),
        },
    ];
    const [columns, setColumns] = (0, react_1.useState)(initialColumns);
    const handleDragEnd = async (result) => {
        const { source, destination, draggableId } = result;
        // Dropped outside a valid drop target
        if (!destination)
            return;
        // No change in position
        if (source.droppableId === destination.droppableId && source.index === destination.index)
            return;
        // Find the source and destination columns
        const sourceColumn = columns.find((col) => col.id === source.droppableId);
        const destColumn = columns.find((col) => col.id === destination.droppableId);
        if (!sourceColumn || !destColumn)
            return;
        // Create new arrays for the columns
        const sourceOrders = [...sourceColumn.orders];
        const destOrders = source.droppableId === destination.droppableId ? sourceOrders : [...destColumn.orders];
        // Remove from source
        const [movedOrder] = sourceOrders.splice(source.index, 1);
        // Add to destination
        destOrders.splice(destination.index, 0, movedOrder);
        // Update columns state
        setColumns(columns.map((col) => {
            if (col.id === source.droppableId) {
                return Object.assign(Object.assign({}, col), { orders: sourceOrders });
            }
            if (col.id === destination.droppableId) {
                return Object.assign(Object.assign({}, col), { orders: destOrders });
            }
            return col;
        }));
        // Update order status in the backend
        if (source.droppableId !== destination.droppableId) {
            try {
                await updateOrderStatus(draggableId, destination.droppableId);
            }
            catch (error) {
                console.error("Failed to update order status:", error);
                // Revert the UI change if the API call fails
                setColumns(initialColumns);
            }
        }
    };
    return (<div className="space-y-4">
      <h2 className="text-2xl font-bold">Order Management</h2>
      <p className="text-muted-foreground">Drag and drop orders to change their status</p>

      <dnd_1.DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {columns.map((column) => (<div key={column.id} className="flex flex-col">
              <div className="mb-2 flex items-center gap-2">
                <column.icon className="h-5 w-5"/>
                <h3 className="font-medium">{column.title}</h3>
                <badge_1.Badge variant="outline">{column.orders.length}</badge_1.Badge>
              </div>
              <dnd_1.Droppable droppableId={column.id}>
                {(provided, snapshot) => (<div ref={provided.innerRef} {...provided.droppableProps} className={(0, utils_1.cn)("flex flex-1 flex-col gap-2 rounded-md border p-2", snapshot.isDraggingOver && "bg-muted")}>
                    {column.orders.map((order, index) => (<dnd_1.Draggable key={order.id} draggableId={order.id} index={index}>
                        {(provided, snapshot) => (<card_1.Card ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={(0, utils_1.cn)("cursor-grab border", snapshot.isDragging && "shadow-lg")}>
                            <card_1.CardHeader className="p-3">
                              <card_1.CardTitle className="text-sm">Order #{order.orderNumber}</card_1.CardTitle>
                            </card_1.CardHeader>
                            <card_1.CardContent className="p-3 pt-0">
                              <div className="text-xs text-muted-foreground">
                                {order.items.length} items · ${order.total.toFixed(2)}
                              </div>
                              <div className="mt-1 text-xs">Table: {order.tableNumber || "Takeout"}</div>
                            </card_1.CardContent>
                          </card_1.Card>)}
                      </dnd_1.Draggable>))}
                    {provided.placeholder}
                    {column.orders.length === 0 && (<div className="flex h-20 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                        No orders
                      </div>)}
                  </div>)}
              </dnd_1.Droppable>
            </div>))}
        </div>
      </dnd_1.DragDropContext>
    </div>);
}
