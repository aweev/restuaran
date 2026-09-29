"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = InventoryPage;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const tabs_1 = require("@/components/ui/tabs");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const inventory_table_1 = require("@/components/inventory/inventory-table");
const ingredient_usage_chart_1 = require("@/components/inventory/ingredient-usage-chart");
const low_stock_alert_1 = require("@/components/inventory/low-stock-alert");
const export_buttons_1 = require("@/components/reports/export-buttons");
const InventoryContext_1 = require("@/context/InventoryContext");
const export_utils_1 = require("@/lib/export-utils");
const lucide_react_1 = require("lucide-react");
const lucide_react_2 = require("lucide-react");
const dialog_1 = require("@/components/ui/dialog");
const add_ingredient_form_1 = require("@/components/inventory/add-ingredient-form");
const date_fns_1 = require("date-fns");
function InventoryPage() {
    const { state, fetchInventory } = (0, InventoryContext_1.useInventory)();
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [searchQuery, setSearchQuery] = (0, react_1.useState)("");
    (0, react_1.useEffect)(() => {
        const loadData = async () => {
            try {
                await fetchInventory();
            }
            catch (error) {
                console.error("Error loading inventory data:", error);
            }
            finally {
                setLoading(false);
            }
        };
        loadData();
    }, [fetchInventory]);
    const filteredIngredients = state.ingredients.filter((ingredient) => ingredient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ingredient.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const lowStockIngredients = state.ingredients.filter((ingredient) => ingredient.currentStock <= ingredient.reorderLevel);
    const handleExportCSV = () => {
        return (0, export_utils_1.exportInventoryToCSV)(filteredIngredients);
    };
    if (loading) {
        return (<div className="flex h-full items-center justify-center">
        <lucide_react_2.Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </div>);
    }
    return (<div className="space-y-4" id="inventory-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Inventory Management</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <dialog_1.Dialog>
            <dialog_1.DialogTrigger asChild>
              <button_1.Button>
                <lucide_react_1.Plus className="mr-2 h-4 w-4"/>
                Add Ingredient
              </button_1.Button>
            </dialog_1.DialogTrigger>
            <dialog_1.DialogContent className="sm:max-w-[425px]">
              <dialog_1.DialogHeader>
                <dialog_1.DialogTitle>Add New Ingredient</dialog_1.DialogTitle>
              </dialog_1.DialogHeader>
              <add_ingredient_form_1.AddIngredientForm />
            </dialog_1.DialogContent>
          </dialog_1.Dialog>
          <export_buttons_1.ExportButtons onExportCSV={handleExportCSV} fileName={`inventory-${(0, date_fns_1.format)(new Date(), "yyyy-MM-dd")}`} pdfElementId="inventory-container"/>
          <button_1.Button variant="outline">
            <lucide_react_1.FileUp className="mr-2 h-4 w-4"/>
            Import
          </button_1.Button>
        </div>
      </div>

      {lowStockIngredients.length > 0 && <low_stock_alert_1.LowStockAlert ingredients={lowStockIngredients}/>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Total Ingredients</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{state.ingredients.length}</div>
            <p className="text-xs text-muted-foreground">{state.ingredients.filter((i) => i.isActive).length} active</p>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Low Stock Items</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">{lowStockIngredients.length}</div>
            <p className="text-xs text-muted-foreground">Need to reorder soon</p>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Inventory Value</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">
              ${state.ingredients.reduce((sum, i) => sum + i.currentStock * i.unitCost, 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Total value of all ingredients</p>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <card_1.CardTitle className="text-sm font-medium">Last Updated</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-2xl font-bold">Today</div>
            <p className="text-xs text-muted-foreground">At 09:32 AM</p>
          </card_1.CardContent>
        </card_1.Card>
      </div>

      <tabs_1.Tabs defaultValue="all" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <tabs_1.TabsList>
            <tabs_1.TabsTrigger value="all">All Ingredients</tabs_1.TabsTrigger>
            <tabs_1.TabsTrigger value="low">Low Stock</tabs_1.TabsTrigger>
            <tabs_1.TabsTrigger value="usage">Usage Analytics</tabs_1.TabsTrigger>
          </tabs_1.TabsList>
          <div className="flex-1 sm:max-w-sm">
            <input_1.Input placeholder="Search ingredients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
          </div>
        </div>
        <tabs_1.TabsContent value="all" className="space-y-4" id="inventory-table">
          <inventory_table_1.InventoryTable ingredients={filteredIngredients}/>
        </tabs_1.TabsContent>
        <tabs_1.TabsContent value="low" className="space-y-4">
          <inventory_table_1.InventoryTable ingredients={lowStockIngredients}/>
        </tabs_1.TabsContent>
        <tabs_1.TabsContent value="usage" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Ingredient Usage</card_1.CardTitle>
              <card_1.CardDescription>Consumption over the last 30 days</card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="pl-2">
              <ingredient_usage_chart_1.IngredientUsageChart ingredients={state.ingredients.slice(0, 10)}/>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>
      </tabs_1.Tabs>
    </div>);
}
