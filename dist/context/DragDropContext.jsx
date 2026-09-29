"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DragDropProvider = DragDropProvider;
exports.useDragDrop = useDragDrop;
const react_1 = require("react");
const DragDropContext = (0, react_1.createContext)(undefined);
function DragDropProvider({ children }) {
    const [isDragging, setIsDragging] = (0, react_1.useState)(false);
    const [dragItem, setDragItem] = (0, react_1.useState)(null);
    const handleDragEnd = (result, callback) => {
        setIsDragging(false);
        setDragItem(null);
        // If no destination or dropped in the same place, do nothing
        if (!result.destination ||
            (result.source.id === result.destination.id && result.source.index === result.destination.index)) {
            return;
        }
        // Call the callback with the result
        if (callback) {
            callback(result);
        }
    };
    return (<DragDropContext.Provider value={{
            isDragging,
            dragItem,
            setDragItem,
            setIsDragging,
            handleDragEnd,
        }}>
      {children}
    </DragDropContext.Provider>);
}
function useDragDrop() {
    const context = (0, react_1.useContext)(DragDropContext);
    if (context === undefined) {
        throw new Error("useDragDrop must be used within a DragDropProvider");
    }
    return context;
}
