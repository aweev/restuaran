"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemCustomizationModal = ItemCustomizationModal;
const react_1 = require("react");
const CartContext_1 = require("@/context/CartContext");
const dialog_1 = require("@/components/ui/dialog");
const button_1 = require("@/components/ui/button");
const label_1 = require("@/components/ui/label");
const textarea_1 = require("@/components/ui/textarea");
const checkbox_1 = require("@/components/ui/checkbox");
const radio_group_1 = require("@/components/ui/radio-group");
const use_toast_1 = require("@/components/ui/use-toast");
function ItemCustomizationModal({ item, isOpen, onClose, existingItem }) {
    const { addItem, updateItemModifiers, updateSpecialInstructions, updateQuantity } = (0, CartContext_1.useCart)();
    const [quantity, setQuantity] = (0, react_1.useState)((existingItem === null || existingItem === void 0 ? void 0 : existingItem.quantity) || 1);
    const [specialInstructions, setSpecialInstructions] = (0, react_1.useState)((existingItem === null || existingItem === void 0 ? void 0 : existingItem.specialInstructions) || "");
    const [selectedModifiers, setSelectedModifiers] = (0, react_1.useState)((existingItem === null || existingItem === void 0 ? void 0 : existingItem.modifiers) || []);
    const handleQuantityChange = (change) => {
        const newQuantity = quantity + change;
        if (newQuantity > 0) {
            setQuantity(newQuantity);
        }
    };
    const handleModifierChange = (modifierId, optionId, multiple) => {
        setSelectedModifiers((prev) => {
            // Find if this modifier already exists in selections
            const existingModifierIndex = prev.findIndex((mod) => mod.modifierId === modifierId);
            if (existingModifierIndex >= 0) {
                // Modifier exists, update its options
                const updatedModifiers = [...prev];
                const currentMod = updatedModifiers[existingModifierIndex];
                if (multiple) {
                    // For checkboxes (multiple selections allowed)
                    const optionIndex = currentMod.optionIds.indexOf(optionId);
                    if (optionIndex >= 0) {
                        // Remove option if already selected
                        currentMod.optionIds = currentMod.optionIds.filter((id) => id !== optionId);
                    }
                    else {
                        // Add option if not selected
                        currentMod.optionIds = [...currentMod.optionIds, optionId];
                    }
                    // If no options left, remove the modifier
                    if (currentMod.optionIds.length === 0) {
                        return updatedModifiers.filter((mod) => mod.modifierId !== modifierId);
                    }
                    return updatedModifiers;
                }
                else {
                    // For radio buttons (single selection)
                    currentMod.optionIds = [optionId];
                    return updatedModifiers;
                }
            }
            else {
                // Modifier doesn't exist, add it
                return [...prev, { modifierId, optionIds: [optionId] }];
            }
        });
    };
    const isOptionSelected = (modifierId, optionId) => {
        const modifier = selectedModifiers.find((mod) => mod.modifierId === modifierId);
        return modifier ? modifier.optionIds.includes(optionId) : false;
    };
    const handleSubmit = () => {
        if (existingItem) {
            // Update existing item
            updateQuantity(existingItem.id, quantity);
            updateItemModifiers(existingItem.id, selectedModifiers);
            updateSpecialInstructions(existingItem.id, specialInstructions);
        }
        else {
            // Add new item
            addItem(item, quantity, selectedModifiers, specialInstructions);
        }
        (0, use_toast_1.toast)({
            title: existingItem ? "Item updated" : "Item added",
            description: `${quantity}x ${item.title} ${existingItem ? "updated in" : "added to"} order`,
        });
        onClose();
    };
    return (<dialog_1.Dialog open={isOpen} onOpenChange={onClose}>
      <dialog_1.DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <dialog_1.DialogHeader>
          <dialog_1.DialogTitle>{existingItem ? "Edit Item" : "Customize Item"}</dialog_1.DialogTitle>
        </dialog_1.DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-md bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${item.image})` }}/>
            <div>
              <h3 className="font-medium">{item.title}</h3>
              <p className="text-sm text-muted-foreground">${item.price.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label_1.Label>Quantity</label_1.Label>
            <div className="flex items-center gap-3">
              <button_1.Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(-1)} disabled={quantity <= 1}>
                -
              </button_1.Button>
              <span className="w-8 text-center">{quantity}</span>
              <button_1.Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(1)}>
                +
              </button_1.Button>
            </div>
          </div>

          {item.modifiers && item.modifiers.length > 0 && (<div className="space-y-4">
              <label_1.Label className="text-base">Options</label_1.Label>

              {item.modifiers.map((modifier) => {
                var _a;
                return (<div key={modifier.id} className="space-y-2">
                  <label_1.Label className="flex items-center justify-between">
                    <span>{modifier.name}</span>
                    {modifier.required && <span className="text-xs text-red-500">Required</span>}
                  </label_1.Label>

                  {modifier.multiple ? (
                    // Checkbox group for multiple selections
                    <div className="space-y-2">
                      {modifier.options.map((option) => (<div key={option.id} className="flex items-center space-x-2">
                          <checkbox_1.Checkbox id={option.id} checked={isOptionSelected(modifier.id, option.id)} onCheckedChange={() => handleModifierChange(modifier.id, option.id, true)}/>
                          <label_1.Label htmlFor={option.id} className="flex-1">
                            {option.name}
                          </label_1.Label>
                          {option.price > 0 && <span className="text-sm">+${option.price.toFixed(2)}</span>}
                        </div>))}
                    </div>) : (
                    // Radio group for single selection
                    <radio_group_1.RadioGroup value={((_a = selectedModifiers.find((mod) => mod.modifierId === modifier.id)) === null || _a === void 0 ? void 0 : _a.optionIds[0]) || ""} onValueChange={(value) => handleModifierChange(modifier.id, value, false)}>
                      {modifier.options.map((option) => (<div key={option.id} className="flex items-center space-x-2">
                          <radio_group_1.RadioGroupItem value={option.id} id={`${modifier.id}-${option.id}`}/>
                          <label_1.Label htmlFor={`${modifier.id}-${option.id}`} className="flex-1">
                            {option.name}
                          </label_1.Label>
                          {option.price > 0 && <span className="text-sm">+${option.price.toFixed(2)}</span>}
                        </div>))}
                    </radio_group_1.RadioGroup>)}
                </div>);
            })}
            </div>)}

          <div className="space-y-2">
            <label_1.Label htmlFor="specialInstructions">Special Instructions</label_1.Label>
            <textarea_1.Textarea id="specialInstructions" placeholder="Any special requests or instructions" value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} rows={3}/>
          </div>
        </div>

        <dialog_1.DialogFooter>
          <button_1.Button variant="outline" onClick={onClose}>
            Cancel
          </button_1.Button>
          <button_1.Button onClick={handleSubmit}>{existingItem ? "Update Item" : "Add to Order"}</button_1.Button>
        </dialog_1.DialogFooter>
      </dialog_1.DialogContent>
    </dialog_1.Dialog>);
}
