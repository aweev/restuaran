"use client"

import type React from "react"

import { useState } from "react"
import { useInventory } from "@/context/InventoryContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

export function AddIngredientForm() {
  const { addIngredient } = useInventory()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    category: "produce",
    unit: "kg",
    currentStock: 0,
    reorderLevel: 0,
    unitCost: 0,
    isActive: true,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setFormData({
      ...formData,
      [name]: type === "number" ? Number.parseFloat(value) : value,
    })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await addIngredient({
        ...formData,
        id: crypto.randomUUID(),
        usageLastMonth: 0,
        lastUpdated: new Date().toISOString(),
      })

      // Reset form
      setFormData({
        name: "",
        category: "produce",
        unit: "kg",
        currentStock: 0,
        reorderLevel: 0,
        unitCost: 0,
        isActive: true,
      })
    } catch (error) {
      console.error("Error adding ingredient:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Ingredient Name</Label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category} onValueChange={(value) => handleSelectChange("category", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="produce">Produce</SelectItem>
              <SelectItem value="meat">Meat</SelectItem>
              <SelectItem value="dairy">Dairy</SelectItem>
              <SelectItem value="grains">Grains</SelectItem>
              <SelectItem value="spices">Spices</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Select value={formData.unit} onValueChange={(value) => handleSelectChange("unit", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">Kilogram (kg)</SelectItem>
              <SelectItem value="g">Gram (g)</SelectItem>
              <SelectItem value="l">Liter (l)</SelectItem>
              <SelectItem value="ml">Milliliter (ml)</SelectItem>
              <SelectItem value="pcs">Pieces (pcs)</SelectItem>
              <SelectItem value="box">Box</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="currentStock">Current Stock</Label>
          <Input
            id="currentStock"
            name="currentStock"
            type="number"
            min="0"
            step="0.01"
            value={formData.currentStock}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reorderLevel">Reorder Level</Label>
          <Input
            id="reorderLevel"
            name="reorderLevel"
            type="number"
            min="0"
            step="0.01"
            value={formData.reorderLevel}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="unitCost">Unit Cost ($)</Label>
        <Input
          id="unitCost"
          name="unitCost"
          type="number"
          min="0"
          step="0.01"
          value={formData.unitCost}
          onChange={handleChange}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Adding...
          </>
        ) : (
          "Add Ingredient"
        )}
      </Button>
    </form>
  )
}
