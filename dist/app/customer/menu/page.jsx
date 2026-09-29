"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CustomerMenuPage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const MenuContext_1 = require("@/context/MenuContext");
const card_1 = require("@/components/ui/card");
const tabs_1 = require("@/components/ui/tabs");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const dialog_1 = require("@/components/ui/dialog");
const separator_1 = require("@/components/ui/separator");
const lucide_react_1 = require("lucide-react");
const input_1 = require("@/components/ui/input");
const scroll_area_1 = require("@/components/ui/scroll-area");
const customer_menu_item_card_1 = require("@/components/customer/customer-menu-item-card");
const customer_header_1 = require("@/components/customer/customer-header");
const customer_footer_1 = require("@/components/customer/customer-footer");
const customer_cart_button_1 = require("@/components/customer/customer-cart-button");
function CustomerMenuPage() {
    const searchParams = (0, navigation_1.useSearchParams)();
    const tableNumber = searchParams.get("table");
    const { state: menuState, fetchMenuItems } = (0, MenuContext_1.useMenu)();
    const [selectedCategory, setSelectedCategory] = (0, react_1.useState)("all");
    const [searchQuery, setSearchQuery] = (0, react_1.useState)("");
    const [filteredItems, setFilteredItems] = (0, react_1.useState)([]);
    const [cartCount, setCartCount] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => {
        fetchMenuItems();
        // Get cart count from localStorage
        const cart = localStorage.getItem("customerCart");
        if (cart) {
            try {
                const parsedCart = JSON.parse(cart);
                setCartCount(parsedCart.items.length);
            }
            catch (error) {
                console.error("Error parsing cart from localStorage", error);
            }
        }
    }, [fetchMenuItems]);
    (0, react_1.useEffect)(() => {
        if (menuState.items.length > 0) {
            let items = menuState.items;
            // Filter by category
            if (selectedCategory !== "all") {
                items = items.filter((item) => item.category === selectedCategory);
            }
            // Filter by search query
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                items = items.filter((item) => item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query));
            }
            setFilteredItems(items);
        }
    }, [menuState.items, selectedCategory, searchQuery]);
    const handleCartUpdate = (count) => {
        setCartCount(count);
    };
    return (<div className="flex flex-col min-h-screen">
      <customer_header_1.CustomerHeader tableNumber={tableNumber}/>

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Our Menu</h1>
            <dialog_1.Dialog>
              <dialog_1.DialogTrigger asChild>
                <button_1.Button variant="outline" size="icon">
                  <lucide_react_1.Info className="h-4 w-4"/>
                </button_1.Button>
              </dialog_1.DialogTrigger>
              <dialog_1.DialogContent>
                <dialog_1.DialogHeader>
                  <dialog_1.DialogTitle>About Our Menu</dialog_1.DialogTitle>
                  <dialog_1.DialogDescription>
                    Browse our menu and add items to your cart. When you&apos;re ready, you can place your order directly
                    from your device.
                  </dialog_1.DialogDescription>
                </dialog_1.DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <badge_1.Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
                      Veg
                    </badge_1.Badge>
                    <span className="text-sm">Vegetarian dishes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <badge_1.Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">
                      Non Veg
                    </badge_1.Badge>
                    <span className="text-sm">Non-vegetarian dishes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <badge_1.Badge variant="secondary">Popular</badge_1.Badge>
                    <span className="text-sm">Our most ordered items</span>
                  </div>
                  <separator_1.Separator />
                  <p className="text-sm text-muted-foreground">
                    If you have any allergies or dietary requirements, please inform our staff before placing your
                    order.
                  </p>
                </div>
              </dialog_1.DialogContent>
            </dialog_1.Dialog>
          </div>

          <div className="relative">
            <lucide_react_1.Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
            <input_1.Input type="search" placeholder="Search menu..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
          </div>

          <tabs_1.Tabs defaultValue="all" value={selectedCategory} onValueChange={(value) => setSelectedCategory(value)}>
            <scroll_area_1.ScrollArea className="w-full">
              <tabs_1.TabsList className="w-auto inline-flex p-1">
                <tabs_1.TabsTrigger value="all">All</tabs_1.TabsTrigger>
                <tabs_1.TabsTrigger value="breakfast">Breakfast</tabs_1.TabsTrigger>
                <tabs_1.TabsTrigger value="soups">Soups</tabs_1.TabsTrigger>
                <tabs_1.TabsTrigger value="pasta">Pasta</tabs_1.TabsTrigger>
                <tabs_1.TabsTrigger value="main">Main Course</tabs_1.TabsTrigger>
                <tabs_1.TabsTrigger value="burgers">Burgers</tabs_1.TabsTrigger>
                <tabs_1.TabsTrigger value="desserts">Desserts</tabs_1.TabsTrigger>
                <tabs_1.TabsTrigger value="drinks">Drinks</tabs_1.TabsTrigger>
                <tabs_1.TabsTrigger value="sides">Sides</tabs_1.TabsTrigger>
              </tabs_1.TabsList>
            </scroll_area_1.ScrollArea>

            <tabs_1.TabsContent value={selectedCategory} className="mt-4">
              {menuState.loading ? (<div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (<card_1.Card key={i} className="animate-pulse">
                      <card_1.CardContent className="p-0">
                        <div className="h-40 bg-muted rounded-t-lg"/>
                        <div className="p-4 space-y-2">
                          <div className="h-5 bg-muted rounded w-3/4"/>
                          <div className="h-4 bg-muted rounded w-1/2"/>
                          <div className="h-4 bg-muted rounded w-1/4"/>
                        </div>
                      </card_1.CardContent>
                    </card_1.Card>))}
                </div>) : filteredItems.length > 0 ? (<div className="space-y-4">
                  {filteredItems.map((item) => (<customer_menu_item_card_1.CustomerMenuItemCard key={item.id} item={item} tableNumber={tableNumber || undefined} onCartUpdate={handleCartUpdate}/>))}
                </div>) : (<card_1.Card>
                  <card_1.CardContent className="flex flex-col items-center justify-center py-8">
                    <p className="text-center text-muted-foreground">No items found</p>
                    {searchQuery && (<button_1.Button variant="link" onClick={() => setSearchQuery("")} className="mt-2">
                        Clear search
                      </button_1.Button>)}
                  </card_1.CardContent>
                </card_1.Card>)}
            </tabs_1.TabsContent>
          </tabs_1.Tabs>
        </div>
      </main>

      <customer_footer_1.CustomerFooter />

      {cartCount > 0 && <customer_cart_button_1.CustomerCartButton count={cartCount} tableNumber={tableNumber || undefined}/>}
    </div>);
}
