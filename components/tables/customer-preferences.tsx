"use client"

import type React from "react"

import { useState } from "react"
import { useCustomer } from "@/context/CustomerContext"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, Edit, Star, AlertCircle, Heart } from "lucide-react"
import { format } from "date-fns"
import { toast } from "@/components/ui/use-toast"
import type { Customer } from "@/types"

export function CustomerPreferences() {
  const { state, searchCustomers, addCustomer, updateCustomer } = useCustomer()
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [, setIsEditDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    allergies: "",
    dietaryRestrictions: "",
    favoriteItems: "",
    seatingPreferences: "",
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchCustomers(searchQuery)
  }

  const handleAddCustomer = async () => {
    if (!newCustomer.name) {
      toast({
        title: "Missing information",
        description: "Please provide at least a customer name.",
        variant: "destructive",
      })
      return
    }

    try {
      await addCustomer({
        ...newCustomer,
        visitCount: 1,
        lastVisit: new Date().toISOString(),
        totalSpent: 0,
      })

      setNewCustomer({
        name: "",
        email: "",
        phone: "",
        notes: "",
        allergies: "",
        dietaryRestrictions: "",
        favoriteItems: "",
        seatingPreferences: "",
      })

      setIsAddDialogOpen(false)

      toast({
        title: "Customer added",
        description: `${newCustomer.name} has been added to the customer database.`,
      })
    } catch (error) {
      console.error("Error adding customer:", error)
      toast({
        title: "Error",
        description: "Failed to add customer.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer) return

    try {
      await updateCustomer(selectedCustomer)

      setIsEditDialogOpen(false)

      toast({
        title: "Customer updated",
        description: `${selectedCustomer.name}'s information has been updated.`,
      })
    } catch (error) {
      console.error("Error updating customer:", error)
      toast({
        title: "Error",
        description: "Failed to update customer information.",
        variant: "destructive",
      })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, isNewCustomer = true) => {
    const { name, value } = e.target

    if (isNewCustomer) {
      setNewCustomer({
        ...newCustomer,
        [name]: value,
      })
    } else {
      // `selectedCustomer` is fully populated (non-null) whenever the edit dialog is
      // open; the dynamic key spread keeps every other field intact.
      setSelectedCustomer({
        ...selectedCustomer,
        [name]: value,
      } as Customer)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <form onSubmit={handleSearch} className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search customers..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Information</TabsTrigger>
                <TabsTrigger value="preferences">Preferences & Allergies</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" name="name" value={newCustomer.name} onChange={(e) => handleInputChange(e)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" name="phone" value={newCustomer.phone} onChange={(e) => handleInputChange(e)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => handleInputChange(e)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seatingPreferences">Seating Preferences</Label>
                    <Input
                      id="seatingPreferences"
                      name="seatingPreferences"
                      value={newCustomer.seatingPreferences}
                      onChange={(e) => handleInputChange(e)}
                      placeholder="e.g., Window seat, Booth, etc."
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="notes">General Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      value={newCustomer.notes}
                      onChange={(e) => handleInputChange(e)}
                      rows={3}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preferences" className="space-y-4 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="allergies">Allergies</Label>
                    <Textarea
                      id="allergies"
                      name="allergies"
                      value={newCustomer.allergies}
                      onChange={(e) => handleInputChange(e)}
                      placeholder="e.g., Peanuts, Shellfish, etc."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dietaryRestrictions">Dietary Restrictions</Label>
                    <Textarea
                      id="dietaryRestrictions"
                      name="dietaryRestrictions"
                      value={newCustomer.dietaryRestrictions}
                      onChange={(e) => handleInputChange(e)}
                      placeholder="e.g., Vegetarian, Gluten-free, etc."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="favoriteItems">Favorite Items</Label>
                    <Textarea
                      id="favoriteItems"
                      name="favoriteItems"
                      value={newCustomer.favoriteItems}
                      onChange={(e) => handleInputChange(e)}
                      placeholder="e.g., Steak medium-rare, Chocolate cake, etc."
                      rows={2}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCustomer}>Add Customer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="h-[500px]">
        {state.loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : state.customers.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            {searchQuery ? "No customers found matching your search" : "No customers in the database"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.customers.map((customer) => (
              <Card key={customer.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{customer.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                      {customer.phone && <div className="text-muted-foreground">{customer.phone}</div>}
                      {customer.email && <div className="text-muted-foreground">{customer.email}</div>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-800">
                        {customer.visitCount} visits
                      </Badge>
                      <Badge variant="outline" className="bg-green-50 text-green-800">
                        ${(customer.totalSpent / 100).toFixed(2)} spent
                      </Badge>
                      {customer.lastVisit && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-800">
                          Last visit: {format(new Date(customer.lastVisit), "MMM d, yyyy")}
                        </Badge>
                      )}
                    </div>

                    {(customer.allergies || customer.dietaryRestrictions) && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span>Allergies & Restrictions</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {customer.allergies && <div>Allergies: {customer.allergies}</div>}
                          {customer.dietaryRestrictions && <div>Dietary: {customer.dietaryRestrictions}</div>}
                        </div>
                      </div>
                    )}

                    {customer.favoriteItems && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <Heart className="h-4 w-4 text-red-500" />
                          <span>Favorites</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{customer.favoriteItems}</div>
                      </div>
                    )}

                    {customer.seatingPreferences && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <Star className="h-4 w-4 text-amber-500" />
                          <span>Seating</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{customer.seatingPreferences}</div>
                      </div>
                    )}

                    {customer.notes && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Notes</div>
                        <div className="text-sm text-muted-foreground">{customer.notes}</div>
                      </div>
                    )}

                    <div className="pt-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setSelectedCustomer(customer)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Profile
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit Customer Profile</DialogTitle>
                          </DialogHeader>

                          {selectedCustomer && (
                            <Tabs defaultValue="basic" className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="basic">Basic Information</TabsTrigger>
                                <TabsTrigger value="preferences">Preferences & Allergies</TabsTrigger>
                              </TabsList>

                              <TabsContent value="basic" className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-name">Full Name</Label>
                                    <Input
                                      id="edit-name"
                                      name="name"
                                      value={selectedCustomer.name}
                                      onChange={(e) => handleInputChange(e, false)}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="edit-phone">Phone Number</Label>
                                    <Input
                                      id="edit-phone"
                                      name="phone"
                                      value={selectedCustomer.phone}
                                      onChange={(e) => handleInputChange(e, false)}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="edit-email">Email Address</Label>
                                    <Input
                                      id="edit-email"
                                      name="email"
                                      type="email"
                                      value={selectedCustomer.email}
                                      onChange={(e) => handleInputChange(e, false)}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="edit-seatingPreferences">Seating Preferences</Label>
                                    <Input
                                      id="edit-seatingPreferences"
                                      name="seatingPreferences"
                                      value={selectedCustomer.seatingPreferences}
                                      onChange={(e) => handleInputChange(e, false)}
                                    />
                                  </div>

                                  <div className="col-span-2 space-y-2">
                                    <Label htmlFor="edit-notes">General Notes</Label>
                                    <Textarea
                                      id="edit-notes"
                                      name="notes"
                                      value={selectedCustomer.notes}
                                      onChange={(e) => handleInputChange(e, false)}
                                      rows={3}
                                    />
                                  </div>
                                </div>
                              </TabsContent>

                              <TabsContent value="preferences" className="space-y-4 py-4">
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-allergies">Allergies</Label>
                                    <Textarea
                                      id="edit-allergies"
                                      name="allergies"
                                      value={selectedCustomer.allergies}
                                      onChange={(e) => handleInputChange(e, false)}
                                      rows={2}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="edit-dietaryRestrictions">Dietary Restrictions</Label>
                                    <Textarea
                                      id="edit-dietaryRestrictions"
                                      name="dietaryRestrictions"
                                      value={selectedCustomer.dietaryRestrictions}
                                      onChange={(e) => handleInputChange(e, false)}
                                      rows={2}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="edit-favoriteItems">Favorite Items</Label>
                                    <Textarea
                                      id="edit-favoriteItems"
                                      name="favoriteItems"
                                      value={selectedCustomer.favoriteItems}
                                      onChange={(e) => handleInputChange(e, false)}
                                      rows={2}
                                    />
                                  </div>
                                </div>
                              </TabsContent>
                            </Tabs>
                          )}

                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleUpdateCustomer}>Update Customer</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
