"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderDropZone = OrderDropZone;
const react_1 = require("react");
const DragDropContext_1 = require("@/context/DragDropContext");
const utils_1 = require("@/lib/utils");
function OrderDropZone({ id, className, children, onDrop, acceptTypes = ["orderItem"] }) {
    const { isDragging, dragItem } = (0, DragDropContext_1.useDragDrop)();
    const [isOver, setIsOver] = (0, react_1.useState)(false);
    // Check if this drop zone can accept the current drag item
    const canAccept = isDragging && dragItem && acceptTypes.includes(dragItem.type);
    const handleDragOver = (e) => {
        if (!canAccept)
            return;
        e.preventDefault();
        setIsOver(true);
    };
    const handleDragLeave = () => {
        setIsOver(false);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsOver(false);
        if (canAccept && dragItem) {
            onDrop(dragItem.data);
        }
    };
    return (<div className={(0, utils_1.cn)("transition-colors", isOver && canAccept && "bg-primary/10 border-primary", canAccept && !isOver && "border-dashed", className)} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} data-drop-zone-id={id}>
      {children}
    </div>);
}
