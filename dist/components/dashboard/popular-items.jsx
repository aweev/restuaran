"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PopularItems = PopularItems;
function PopularItems({ menuItems }) {
    if (menuItems.length === 0) {
        return <p className="text-sm text-muted-foreground">No popular items</p>;
    }
    return (<div className="space-y-4">
      {menuItems.slice(0, 5).map((item) => (<div key={item.id} className="flex items-center gap-3 border-b pb-2">
          <div className="h-10 w-10 overflow-hidden rounded-md">
            <img src={item.image || "/placeholder.svg?height=40&width=40"} alt={item.title} className="h-full w-full object-cover"/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.category}</p>
          </div>
          <div className="text-sm font-medium">${item.price.toFixed(2)}</div>
        </div>))}
    </div>);
}
