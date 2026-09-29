"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FoodCard = FoodCard;
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
function FoodCard({ image, title, price, discount, type }) {
    return (<card_1.Card className="overflow-hidden">
      <div className="relative">
        <img src={image || "/placeholder.svg"} alt={title} className="w-full h-40 object-cover"/>
        {discount && (<div className="absolute top-2 left-2 bg-yellow-400 text-black px-2 py-1 rounded-md text-xs font-medium">
            {discount}% Off
          </div>)}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium mb-1">{title}</h3>
        <div className="flex justify-between items-center mb-2">
          <span className="text-green-600 font-bold">${price.toFixed(2)}</span>
          <div className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${type === "Veg" ? "bg-green-500" : "bg-red-500"}`}></span>
            <span className="text-xs text-gray-500">{type}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button_1.Button variant="outline" size="icon" className="rounded-full">
            <lucide_react_1.Minus className="h-4 w-4"/>
          </button_1.Button>
          <span className="font-medium">1</span>
          <button_1.Button variant="outline" size="icon" className="rounded-full">
            <lucide_react_1.Plus className="h-4 w-4"/>
          </button_1.Button>
        </div>
      </div>
    </card_1.Card>);
}
