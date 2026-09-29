"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryFilter = CategoryFilter;
const lucide_react_1 = require("lucide-react");
const categories = [
    { icon: lucide_react_1.Grid, label: "All", items: "235 Items", active: true },
    { icon: lucide_react_1.Coffee, label: "Breakfast", items: "19 Items" },
    { icon: lucide_react_1.Soup, label: "Soups", items: "8 Items" },
    { icon: lucide_react_1.UtensilsCrossed, label: "Pasta", items: "14 Items" },
    { icon: lucide_react_1.ChefHat, label: "Main Course", items: "27 Items" },
    { icon: lucide_react_1.Sandwich, label: "Burges", items: "13 Items" },
];
function CategoryFilter() {
    return (<div className="flex gap-3 mb-4 overflow-x-auto pb-2">
      {categories.map((category, index) => (<div key={index} className={`flex flex-col items-center p-3 rounded-xl min-w-[100px] ${category.active ? "bg-green-50 text-green-600" : "bg-white"} border cursor-pointer hover:bg-green-50`}>
          <category.icon className="h-6 w-6 mb-1"/>
          <span className="text-sm font-medium">{category.label}</span>
          <span className="text-xs text-gray-500">{category.items}</span>
        </div>))}
    </div>);
}
