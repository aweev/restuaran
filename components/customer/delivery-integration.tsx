"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Truck } from "lucide-react"
import type { Order } from "@/types"

interface DeliveryIntegrationProps {
  order: Order
}

type DeliveryProvider = "doordash" | "ubereats" | "grubhub" | "restaurant"

interface DeliveryAddress {
  street: string
  city: string
  state: string
  zipCode: string
  instructions?: string
}

export function DeliveryIntegration({ order }: DeliveryIntegrationProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<DeliveryProvider>("restaurant")
  const [address, setAddress] = useState<DeliveryAddress>({
    street: "",
    city: "",
    state: "",
    zipCode: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddressChange = (field: keyof DeliveryAddress, value: string) => {
    setAddress((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async () => {
    // Validate address
    if (!address.street || !address.city || !address.state || !address.zipCode) {
      toast({
        title: "Missing information",
        description: "Please fill in all address fields",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/customer/orders/${order.id}/delivery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: selectedProvider,
          address,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to set up delivery")
      }

      const data = await response.json()

      toast({
        title: "Delivery set up successfully",
        description:
          selectedProvider === "restaurant"
            ? "Your order will be delivered by our restaurant"
            : `Your order has been sent to ${selectedProvider}`,
      })

      setIsDialogOpen(false)

      // If external provider, redirect to their site
      if (selectedProvider !== "restaurant" && data.redirectUrl) {
        window.open(data.redirectUrl, "_blank")
      }
    } catch (error) {
      console.error("Error setting up delivery:", error)
      toast({
        title: "Error",
        description: "Failed to set up delivery. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Truck className="mr-2 h-4 w-4" />
          Set Up Delivery
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delivery Options</DialogTitle>
          <DialogDescription>Choose a delivery provider and enter your address</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Delivery Provider</Label>
            <RadioGroup
              value={selectedProvider}
              onValueChange={(value) => setSelectedProvider(value as DeliveryProvider)}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex flex-col items-center gap-2 rounded-md border p-4 hover:bg-muted">
                <RadioGroupItem value="restaurant" id="restaurant" className="sr-only" />
                <Label htmlFor="restaurant" className="cursor-pointer text-center">
                  <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Truck className="h-6 w-6" />
                  </div>
                  Restaurant Delivery
                </Label>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-md border p-4 hover:bg-muted">
                <RadioGroupItem value="doordash" id="doordash" className="sr-only" />
                <Label htmlFor="doordash" className="cursor-pointer text-center">
                  <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="font-bold text-red-600">DD</span>
                  </div>
                  DoorDash
                </Label>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-md border p-4 hover:bg-muted">
                <RadioGroupItem value="ubereats" id="ubereats" className="sr-only" />
                <Label htmlFor="ubereats" className="cursor-pointer text-center">
                  <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-black flex items-center justify-center">
                    <span className="font-bold text-white">UE</span>
                  </div>
                  Uber Eats
                </Label>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-md border p-4 hover:bg-muted">
                <RadioGroupItem value="grubhub" id="grubhub" className="sr-only" />
                <Label htmlFor="grubhub" className="cursor-pointer text-center">
                  <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                    <span className="font-bold text-orange-600">GH</span>
                  </div>
                  Grubhub
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium">Delivery Address</h3>

            <div className="space-y-2">
              <Label htmlFor="street">Street Address</Label>
              <Input
                id="street"
                value={address.street}
                onChange={(e) => handleAddressChange("street", e.target.value)}
                placeholder="123 Main St"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={address.city}
                  onChange={(e) => handleAddressChange("city", e.target.value)}
                  placeholder="New York"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={address.state}
                  onChange={(e) => handleAddressChange("state", e.target.value)}
                  placeholder="NY"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input
                id="zipCode"
                value={address.zipCode}
                onChange={(e) => handleAddressChange("zipCode", e.target.value)}
                placeholder="10001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Delivery Instructions (Optional)</Label>
              <Textarea
                id="instructions"
                value={address.instructions || ""}
                onChange={(e) => handleAddressChange("instructions", e.target.value)}
                placeholder="Apartment number, gate code, etc."
                className="resize-none"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Confirm Delivery"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
