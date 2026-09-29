"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuItemCard = MenuItemCard;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const badge_1 = require("@/components/ui/badge");
const switch_1 = require("@/components/ui/switch");
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
const MenuContext_1 = require("@/context/MenuContext");
function MenuItemCard({ menuItem }) {
    const { updateItemAvailability } = (0, MenuContext_1.useMenu)();
    const [isUpdating, setIsUpdating] = (0, react_1.useState)(false);
    const handleAvailabilityChange = async (available) => {
        setIsUpdating(true);
        try {
            await updateItemAvailability(menuItem.id, available);
        }
        catch (error) {
            console.error("Error updating item availability:", error);
        }
        finally {
            setIsUpdating(false);
        }
    };
    return (<card_1.Card>
      <div className="relative">
        <img src={menuItem.image || "/placeholder.svg?height=200&width=400"} alt={menuItem.title} className="h-48 w-full object-cover"/>
        {menuItem.discount && <badge_1.Badge className="absolute right-2 top-2 bg-yellow-500">{menuItem.discount}% Off</badge_1.Badge>}
        {menuItem.popular && <badge_1.Badge className="absolute left-2 top-2 bg-red-500">Popular</badge_1.Badge>}
      </div>
      <card_1.CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{menuItem.title}</h3>
          <div className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${menuItem.type === "Veg" ? "bg-green-500" : "bg-red-500"}`}></span>
            <span className="text-xs text-muted-foreground">{menuItem.type}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{menuItem.description}</p>
      </card_1.CardHeader>
      <card_1.CardContent className="p-4 pt-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-green-600">${menuItem.price.toFixed(2)}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Available</span>
            <switch_1.Switch checked={menuItem.available} onCheckedChange={handleAvailabilityChange} disabled={isUpdating}/>
          </div>
        </div>
      </card_1.CardContent>
      <card_1.CardFooter className="flex justify-between p-4 pt-0">
        <button_1.Button variant="outline" size="sm">
          <lucide_react_1.Edit className="mr-2 h-4 w-4"/> Edit
        </button_1.Button>
        <button_1.Button variant="outline" size="sm" className="text-red-500 hover:text-red-600">
          <lucide_react_1.Trash2 className="mr-2 h-4 w-4"/> Delete
        </button_1.Button>
      </card_1.CardFooter>
    </card_1.Card>);
}
