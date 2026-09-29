"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MenuPage;
const react_1 = require("react");
const MenuContext_1 = require("@/context/MenuContext");
const card_1 = require("@/components/ui/card");
const tabs_1 = require("@/components/ui/tabs");
const input_1 = require("@/components/ui/input");
const button_1 = require("@/components/ui/button");
const menu_item_card_1 = require("@/components/menu/menu-item-card");
const lucide_react_1 = require("lucide-react");
function MenuPage() {
    const { state, fetchMenu, setSelectedCategory } = (0, MenuContext_1.useMenu)();
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [searchQuery, setSearchQuery] = (0, react_1.useState)("");
    (0, react_1.useEffect)(() => {
        const loadData = async () => {
            try {
                await fetchMenu();
            }
            catch (error) {
                console.error("Error loading menu data:", error);
            }
            finally {
                setLoading(false);
            }
        };
        loadData();
    }, [fetchMenu]);
    const handleCategoryChange = (category) => {
        setSelectedCategory(category);
    };
    const filteredItems = state.items.filter((item) => {
        // Filter by category
        if (state.selectedCategory !== "all" && item.category.toLowerCase() !== state.selectedCategory) {
            return false;
        }
        // Filter by search query
        if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }
        return true;
    });
    if (loading) {
        return (<div className="flex h-full items-center justify-center">
        <lucide_react_1.Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </div>);
    }
    return (<div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Menu Management</h2>
        <button_1.Button>
          <lucide_react_1.Plus className="mr-2 h-4 w-4"/> Add Item
        </button_1.Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <lucide_react_1.Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
          <input_1.Input type="search" placeholder="Search menu items..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
        </div>
      </div>

      <tabs_1.Tabs defaultValue="all" onValueChange={(value) => handleCategoryChange(value)}>
        <tabs_1.TabsList className="mb-4 flex flex-wrap">
          {state.categories.map((category) => (<tabs_1.TabsTrigger key={category.id} value={category.id}>
              {category.label} ({category.items})
            </tabs_1.TabsTrigger>))}
        </tabs_1.TabsList>

        <tabs_1.TabsContent value={state.selectedCategory} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.length > 0 ? (filteredItems.map((item) => <menu_item_card_1.MenuItemCard key={item.id} menuItem={item}/>)) : (<card_1.Card className="col-span-full">
                <card_1.CardContent className="flex h-40 items-center justify-center">
                  <p className="text-muted-foreground">No menu items found</p>
                </card_1.CardContent>
              </card_1.Card>)}
          </div>
        </tabs_1.TabsContent>
      </tabs_1.Tabs>
    </div>);
}
