"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerCartItem = CustomerCartItem;
const image_1 = __importDefault(require("next/image"));
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
function CustomerCartItem({ item, onRemove, onUpdateQuantity }) {
    const handleQuantityChange = (increment) => {
        const newQuantity = increment ? item.quantity + 1 : item.quantity - 1;
        onUpdateQuantity(newQuantity);
    };
    // Format modifiers for display
    const formatModifiers = () => {
        if (!item.modifiers || item.modifiers.length === 0) {
            return null;
        }
        return (<ul className="text-xs text-muted-foreground mt-1">
        {item.modifiers.map((modifier, index) => (<li key={index}>
            {/* In a real app, you'd fetch the modifier names from the menu context */}
            {/* For now, we'll just show the IDs */}
            Modifier: {modifier.optionIds.join(", ")}
          </li>))}
      </ul>);
    };
    return (<card_1.Card>
      <card_1.CardContent className="p-4">
        <div className="flex gap-3">
          <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden">
            <image_1.default src={item.image || "/placeholder.svg?height=64&width=64"} alt={item.title} fill className="object-cover"/>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between">
              <h3 className="font-medium truncate">{item.title}</h3>
              <button_1.Button variant="ghost" size="icon" className="h-6 w-6 -mr-2" onClick={onRemove}>
                <lucide_react_1.Trash2 className="h-4 w-4"/>
              </button_1.Button>
            </div>

            {formatModifiers()}

            {item.specialInstructions && (<p className="text-xs text-muted-foreground mt-1">Note: {item.specialInstructions}</p>)}

            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center space-x-2">
                <button_1.Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(false)} disabled={item.quantity <= 1}>
                  <lucide_react_1.Minus className="h-3 w-3"/>
                </button_1.Button>
                <span className="w-6 text-center text-sm">{item.quantity}</span>
                <button_1.Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(true)}>
                  <lucide_react_1.Plus className="h-3 w-3"/>
                </button_1.Button>
              </div>

              <div className="font-medium">${item.totalPrice.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </card_1.CardContent>
    </card_1.Card>);
}
