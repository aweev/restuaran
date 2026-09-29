"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderItemList = OrderItemList;
const CartContext_1 = require("@/context/CartContext");
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
function OrderItemList({ items, onItemClick, editable = true }) {
    const { removeItem, updateQuantity } = (0, CartContext_1.useCart)();
    const handleQuantityChange = (id, change, currentQuantity) => {
        const newQuantity = currentQuantity + change;
        if (newQuantity <= 0) {
            removeItem(id);
        }
        else {
            updateQuantity(id, newQuantity);
        }
    };
    if (items.length === 0) {
        return (<div className="flex h-40 items-center justify-center rounded-md border border-dashed">
        <p className="text-sm text-muted-foreground">No items added to the order</p>
      </div>);
    }
    return (<div className="space-y-3">
      {items.map((item) => (<div key={item.id} className="flex items-center justify-between rounded-md border p-3">
          <div className="flex flex-1 items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${item.image})` }}/>
            <div className="flex-1">
              <h4 className="text-sm font-medium">{item.title}</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  ${item.price.toFixed(2)} × {item.quantity}
                </span>
                <span className="font-medium">${item.totalPrice.toFixed(2)}</span>
              </div>
              {item.specialInstructions && (<p className="mt-1 text-xs text-muted-foreground">Note: {item.specialInstructions}</p>)}
              {item.modifiers && item.modifiers.length > 0 && (<div className="mt-1">
                  {item.modifiers.map((mod, index) => (<span key={index} className="mr-1 text-xs text-muted-foreground">
                      +{mod.modifierId.split("-")[0]}
                    </span>))}
                </div>)}
            </div>
          </div>

          {editable && (<div className="flex items-center gap-2">
              <button_1.Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item.id, -1, item.quantity)}>
                <lucide_react_1.Minus className="h-3 w-3"/>
              </button_1.Button>
              <span className="w-5 text-center">{item.quantity}</span>
              <button_1.Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item.id, 1, item.quantity)}>
                <lucide_react_1.Plus className="h-3 w-3"/>
              </button_1.Button>
              <button_1.Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => removeItem(item.id)}>
                <lucide_react_1.Trash2 className="h-4 w-4"/>
              </button_1.Button>
              {onItemClick && (<button_1.Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        // This is a placeholder since we don't have the full MenuItem object
                        // In a real implementation, you'd need to fetch the full item or store it
                        const menuItem = {
                            id: item.menuItemId,
                            title: item.title,
                            description: "",
                            price: item.price,
                            image: item.image || "",
                            category: "all",
                            type: item.type,
                            available: true,
                        };
                        onItemClick(menuItem);
                    }}>
                  <lucide_react_1.Edit className="h-4 w-4"/>
                </button_1.Button>)}
            </div>)}
        </div>))}
    </div>);
}
