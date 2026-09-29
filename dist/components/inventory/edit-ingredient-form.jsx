"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditIngredientForm = EditIngredientForm;
const react_1 = require("react");
const InventoryContext_1 = require("@/context/InventoryContext");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const select_1 = require("@/components/ui/select");
const lucide_react_1 = require("lucide-react");
function EditIngredientForm({ ingredient }) {
    const { updateIngredient } = (0, InventoryContext_1.useInventory)();
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const [formData, setFormData] = (0, react_1.useState)({
        id: ingredient.id,
        name: ingredient.name,
        category: ingredient.category,
        unit: ingredient.unit,
        currentStock: ingredient.currentStock,
        reorderLevel: ingredient.reorderLevel,
        unitCost: ingredient.unitCost,
        isActive: ingredient.isActive,
        usageLastMonth: ingredient.usageLastMonth,
        lastUpdated: ingredient.lastUpdated,
    });
    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(Object.assign(Object.assign({}, formData), { [name]: type === "number" ? Number.parseFloat(value) : value }));
    };
    const handleSelectChange = (name, value) => {
        setFormData(Object.assign(Object.assign({}, formData), { [name]: value }));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await updateIngredient(Object.assign(Object.assign({}, formData), { lastUpdated: new Date().toISOString() }));
        }
        catch (error) {
            console.error("Error updating ingredient:", error);
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label_1.Label htmlFor="name">Ingredient Name</label_1.Label>
        <input_1.Input id="name" name="name" value={formData.name} onChange={handleChange} required/>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label_1.Label htmlFor="category">Category</label_1.Label>
          <select_1.Select value={formData.category} onValueChange={(value) => handleSelectChange("category", value)}>
            <select_1.SelectTrigger>
              <select_1.SelectValue placeholder="Select category"/>
            </select_1.SelectTrigger>
            <select_1.SelectContent>
              <select_1.SelectItem value="produce">Produce</select_1.SelectItem>
              <select_1.SelectItem value="meat">Meat</select_1.SelectItem>
              <select_1.SelectItem value="dairy">Dairy</select_1.SelectItem>
              <select_1.SelectItem value="grains">Grains</select_1.SelectItem>
              <select_1.SelectItem value="spices">Spices</select_1.SelectItem>
              <select_1.SelectItem value="other">Other</select_1.SelectItem>
            </select_1.SelectContent>
          </select_1.Select>
        </div>

        <div className="space-y-2">
          <label_1.Label htmlFor="unit">Unit</label_1.Label>
          <select_1.Select value={formData.unit} onValueChange={(value) => handleSelectChange("unit", value)}>
            <select_1.SelectTrigger>
              <select_1.SelectValue placeholder="Select unit"/>
            </select_1.SelectTrigger>
            <select_1.SelectContent>
              <select_1.SelectItem value="kg">Kilogram (kg)</select_1.SelectItem>
              <select_1.SelectItem value="g">Gram (g)</select_1.SelectItem>
              <select_1.SelectItem value="l">Liter (l)</select_1.SelectItem>
              <select_1.SelectItem value="ml">Milliliter (ml)</select_1.SelectItem>
              <select_1.SelectItem value="pcs">Pieces (pcs)</select_1.SelectItem>
              <select_1.SelectItem value="box">Box</select_1.SelectItem>
            </select_1.SelectContent>
          </select_1.Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label_1.Label htmlFor="currentStock">Current Stock</label_1.Label>
          <input_1.Input id="currentStock" name="currentStock" type="number" min="0" step="0.01" value={formData.currentStock} onChange={handleChange} required/>
        </div>

        <div className="space-y-2">
          <label_1.Label htmlFor="reorderLevel">Reorder Level</label_1.Label>
          <input_1.Input id="reorderLevel" name="reorderLevel" type="number" min="0" step="0.01" value={formData.reorderLevel} onChange={handleChange} required/>
        </div>
      </div>

      <div className="space-y-2">
        <label_1.Label htmlFor="unitCost">Unit Cost ($)</label_1.Label>
        <input_1.Input id="unitCost" name="unitCost" type="number" min="0" step="0.01" value={formData.unitCost} onChange={handleChange} required/>
      </div>

      <button_1.Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (<>
            <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
            Updating...
          </>) : ("Update Ingredient")}
      </button_1.Button>
    </form>);
}
