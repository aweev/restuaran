"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraggableOrderItem = DraggableOrderItem;
const react_1 = require("react");
const DragDropContext_1 = require("@/context/DragDropContext");
const utils_1 = require("@/lib/utils");
const lucide_react_1 = require("lucide-react");
const button_1 = require("@/components/ui/button");
function DraggableOrderItem({ id, name, price, quantity, onRemove, onQuantityChange, index, }) {
    const { setIsDragging, setDragItem } = (0, DragDropContext_1.useDragDrop)();
    const [isDraggingThis, setIsDraggingThis] = (0, react_1.useState)(false);
    const dragRef = (0, react_1.useRef)(null);
    const dragStartPosRef = (0, react_1.useRef)(null);
    const dragCurrentPosRef = (0, react_1.useRef)(null);
    const handleDragStart = (e) => {
        e.preventDefault();
        // Set initial position
        dragStartPosRef.current = { x: e.clientX, y: e.clientY };
        dragCurrentPosRef.current = { x: e.clientX, y: e.clientY };
        // Set dragging state
        setIsDraggingThis(true);
        setIsDragging(true);
        setDragItem({
            id,
            type: "orderItem",
            data: { id, name, price, quantity, index },
        });
        // Add event listeners for drag movement and end
        document.addEventListener("mousemove", handleDragMove);
        document.addEventListener("mouseup", handleDragEnd);
    };
    const handleDragMove = (e) => {
        if (!dragStartPosRef.current || !dragRef.current)
            return;
        dragCurrentPosRef.current = { x: e.clientX, y: e.clientY };
        // Calculate the difference from the start position
        const dx = dragCurrentPosRef.current.x - dragStartPosRef.current.x;
        const dy = dragCurrentPosRef.current.y - dragStartPosRef.current.y;
        // Apply transform to the element
        dragRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
        dragRef.current.style.zIndex = "50";
    };
    const handleDragEnd = () => {
        // Reset position and state
        if (dragRef.current) {
            dragRef.current.style.transform = "";
            dragRef.current.style.zIndex = "";
        }
        setIsDraggingThis(false);
        setIsDragging(false);
        setDragItem(null);
        // Remove event listeners
        document.removeEventListener("mousemove", handleDragMove);
        document.removeEventListener("mouseup", handleDragEnd);
    };
    return (<div ref={dragRef} className={(0, utils_1.cn)("flex items-center justify-between rounded-md border p-3 mb-2 bg-background", isDraggingThis && "opacity-50 cursor-grabbing", !isDraggingThis && "cursor-grab")} data-order-item-id={id} data-index={index}>
      <div className="flex items-center gap-2">
        <div className="p-1 cursor-grab touch-none" onMouseDown={handleDragStart} aria-label="Drag to reorder">
          <lucide_react_1.GripVertical className="h-4 w-4 text-muted-foreground"/>
        </div>
        <div className="flex-1">
          <div className="font-medium">{name}</div>
          <div className="text-sm text-muted-foreground">${price.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center border rounded-md">
          <button_1.Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none" onClick={() => onQuantityChange(id, Math.max(1, quantity - 1))} aria-label="Decrease quantity">
            -
          </button_1.Button>
          <div className="w-8 text-center">{quantity}</div>
          <button_1.Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none" onClick={() => onQuantityChange(id, quantity + 1)} aria-label="Increase quantity">
            +
          </button_1.Button>
        </div>
        <div className="w-20 text-right font-medium">${(price * quantity).toFixed(2)}</div>
        <button_1.Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemove(id)} aria-label="Remove item">
          <lucide_react_1.X className="h-4 w-4"/>
        </button_1.Button>
      </div>
    </div>);
}
