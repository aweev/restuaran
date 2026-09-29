"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NewOrderPage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const MenuContext_1 = require("@/context/MenuContext");
const card_1 = require("@/components/ui/card");
const tabs_1 = require("@/components/ui/tabs");
const input_1 = require("@/components/ui/input");
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
const create_order_form_1 = require("@/components/orders/create-order-form");
const food_card_1 = require("@/components/food-card");
const category_filter_1 = require("@/components/category-filter");
const CartContext_1 = require("@/context/CartContext");
function NewOrderPage() {
    const router = (0, navigation_1.useRouter)();
    const { state: menuState, fetchMenuItems } = (0, MenuContext_1.useMenu)();
    const { state: cartState } = (0, CartContext_1.useCart)();
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [searchQuery, setSearchQuery] = (0, react_1.useState)("");
    const [selectedCategory, setSelectedCategory] = (0, react_1.useState)("all");
    (0, react_1.useEffect)(() => {
        const loadData = async () => {
            try {
                await fetchMenuItems();
            }
            catch (error) {
                console.error("Error loading menu data:", error);
            }
            finally {
                setLoading(false);
            }
        };
        loadData();
    }, [fetchMenuItems]);
    const filteredItems = menuState.items.filter((item) => {
        // Filter by category
        if (selectedCategory !== "all" && item.category !== selectedCategory) {
            return false;
        }
        // Filter by search query
        if (searchQuery) {
            const searchLower = searchQuery.toLowerCase();
            return item.title.toLowerCase().includes(searchLower) || item.description.toLowerCase().includes(searchLower);
        }
        return true;
    });
    const handleItemClick = (item) => {
        // This would open the item customization modal
    };
    if (loading) {
        return (<div className="flex h-full items-center justify-center">
        <lucide_react_1.Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </div>);
    }
    return (<div className="flex h-full flex-col md:flex-row">
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">New Order</h2>
          <button_1.Button onClick={() => router.push("/dashboard/orders")}>
            <lucide_react_1.ShoppingCart className="mr-2 h-4 w-4"/>
            Cart ({cartState.items.length})
          </button_1.Button>
        </div>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <lucide_react_1.Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
            <input_1.Input type="search" placeholder="Search menu items..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
          </div>
          <category_filter_1.CategoryFilter categories={menuState.categories} selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory}/>
        </div>

        <tabs_1.Tabs defaultValue="grid">
          <tabs_1.TabsList className="mb-4">
            <tabs_1.TabsTrigger value="grid">Grid View</tabs_1.TabsTrigger>
            <tabs_1.TabsTrigger value="list">List View</tabs_1.TabsTrigger>
          </tabs_1.TabsList>

          <tabs_1.TabsContent value="grid" className="space-y-4">
            {filteredItems.length > 0 ? (<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredItems.map((item) => (<food_card_1.FoodCard key={item.id} title={item.title} description={item.description} price={item.price} image={item.image} type={item.type} onClick={() => handleItemClick(item)}/>))}
              </div>) : (<card_1.Card>
                <card_1.CardContent className="flex h-40 items-center justify-center">
                  <p className="text-muted-foreground">No menu items found</p>
                </card_1.CardContent>
              </card_1.Card>)}
          </tabs_1.TabsContent>

          <tabs_1.TabsContent value="list" className="space-y-4">
            {filteredItems.length > 0 ? (<div className="space-y-2">
                {filteredItems.map((item) => (<card_1.Card key={item.id} className="overflow-hidden">
                    <card_1.CardContent className="flex items-center gap-4 p-4">
                      <div className="h-16 w-16 rounded-md bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${item.image})` }}/>
                      <div className="flex-1">
                        <h3 className="font-medium">{item.title}</h3>
                        <p className="line-clamp-1 text-sm text-muted-foreground">{item.description}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="font-medium">${item.price.toFixed(2)}</span>
                          <button_1.Button size="sm" onClick={() => handleItemClick(item)}>
                            Add to Order
                          </button_1.Button>
                        </div>
                      </div>
                    </card_1.CardContent>
                  </card_1.Card>))}
              </div>) : (<card_1.Card>
                <card_1.CardContent className="flex h-40 items-center justify-center">
                  <p className="text-muted-foreground">No menu items found</p>
                </card_1.CardContent>
              </card_1.Card>)}
          </tabs_1.TabsContent>
        </tabs_1.Tabs>
      </div>

      <div className="w-full border-t md:w-[400px] md:border-l md:border-t-0">
        <create_order_form_1.CreateOrderForm />
      </div>
    </div>);
}
