"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerPreferences = CustomerPreferences;
const react_1 = require("react");
const CustomerContext_1 = require("@/context/CustomerContext");
const input_1 = require("@/components/ui/input");
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
const tabs_1 = require("@/components/ui/tabs");
const dialog_1 = require("@/components/ui/dialog");
const label_1 = require("@/components/ui/label");
const textarea_1 = require("@/components/ui/textarea");
const badge_1 = require("@/components/ui/badge");
const scroll_area_1 = require("@/components/ui/scroll-area");
const lucide_react_1 = require("lucide-react");
const date_fns_1 = require("date-fns");
const use_toast_1 = require("@/components/ui/use-toast");
function CustomerPreferences() {
    const { state, searchCustomers, addCustomer, updateCustomer } = (0, CustomerContext_1.useCustomer)();
    const [searchQuery, setSearchQuery] = (0, react_1.useState)("");
    const [isAddDialogOpen, setIsAddDialogOpen] = (0, react_1.useState)(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = (0, react_1.useState)(false);
    const [selectedCustomer, setSelectedCustomer] = (0, react_1.useState)(null);
    const [newCustomer, setNewCustomer] = (0, react_1.useState)({
        name: "",
        email: "",
        phone: "",
        notes: "",
        allergies: "",
        dietaryRestrictions: "",
        favoriteItems: "",
        seatingPreferences: "",
    });
    const handleSearch = (e) => {
        e.preventDefault();
        searchCustomers(searchQuery);
    };
    const handleAddCustomer = async () => {
        if (!newCustomer.name) {
            (0, use_toast_1.toast)({
                title: "Missing information",
                description: "Please provide at least a customer name.",
                variant: "destructive",
            });
            return;
        }
        try {
            await addCustomer(Object.assign(Object.assign({}, newCustomer), { visitCount: 1, lastVisit: new Date().toISOString(), totalSpent: 0 }));
            setNewCustomer({
                name: "",
                email: "",
                phone: "",
                notes: "",
                allergies: "",
                dietaryRestrictions: "",
                favoriteItems: "",
                seatingPreferences: "",
            });
            setIsAddDialogOpen(false);
            (0, use_toast_1.toast)({
                title: "Customer added",
                description: `${newCustomer.name} has been added to the customer database.`,
            });
        }
        catch (error) {
            console.error("Error adding customer:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to add customer.",
                variant: "destructive",
            });
        }
    };
    const handleUpdateCustomer = async () => {
        if (!selectedCustomer)
            return;
        try {
            await updateCustomer(selectedCustomer);
            setIsEditDialogOpen(false);
            (0, use_toast_1.toast)({
                title: "Customer updated",
                description: `${selectedCustomer.name}'s information has been updated.`,
            });
        }
        catch (error) {
            console.error("Error updating customer:", error);
            (0, use_toast_1.toast)({
                title: "Error",
                description: "Failed to update customer information.",
                variant: "destructive",
            });
        }
    };
    const handleInputChange = (e, isNewCustomer = true) => {
        const { name, value } = e.target;
        if (isNewCustomer) {
            setNewCustomer(Object.assign(Object.assign({}, newCustomer), { [name]: value }));
        }
        else {
            setSelectedCustomer(Object.assign(Object.assign({}, selectedCustomer), { [name]: value }));
        }
    };
    return (<div className="space-y-4">
      <div className="flex items-center justify-between">
        <form onSubmit={handleSearch} className="relative w-full max-w-sm">
          <lucide_react_1.Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
          <input_1.Input type="search" placeholder="Search customers..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
        </form>

        <dialog_1.Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <dialog_1.DialogTrigger asChild>
            <button_1.Button>
              <lucide_react_1.Plus className="mr-2 h-4 w-4"/> Add Customer
            </button_1.Button>
          </dialog_1.DialogTrigger>
          <dialog_1.DialogContent className="max-w-2xl">
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle>Add New Customer</dialog_1.DialogTitle>
            </dialog_1.DialogHeader>

            <tabs_1.Tabs defaultValue="basic" className="w-full">
              <tabs_1.TabsList className="grid w-full grid-cols-2">
                <tabs_1.TabsTrigger value="basic">Basic Information</tabs_1.TabsTrigger>
                <tabs_1.TabsTrigger value="preferences">Preferences & Allergies</tabs_1.TabsTrigger>
              </tabs_1.TabsList>

              <tabs_1.TabsContent value="basic" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label_1.Label htmlFor="name">Full Name</label_1.Label>
                    <input_1.Input id="name" name="name" value={newCustomer.name} onChange={(e) => handleInputChange(e)}/>
                  </div>

                  <div className="space-y-2">
                    <label_1.Label htmlFor="phone">Phone Number</label_1.Label>
                    <input_1.Input id="phone" name="phone" value={newCustomer.phone} onChange={(e) => handleInputChange(e)}/>
                  </div>

                  <div className="space-y-2">
                    <label_1.Label htmlFor="email">Email Address</label_1.Label>
                    <input_1.Input id="email" name="email" type="email" value={newCustomer.email} onChange={(e) => handleInputChange(e)}/>
                  </div>

                  <div className="space-y-2">
                    <label_1.Label htmlFor="seatingPreferences">Seating Preferences</label_1.Label>
                    <input_1.Input id="seatingPreferences" name="seatingPreferences" value={newCustomer.seatingPreferences} onChange={(e) => handleInputChange(e)} placeholder="e.g., Window seat, Booth, etc."/>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <label_1.Label htmlFor="notes">General Notes</label_1.Label>
                    <textarea_1.Textarea id="notes" name="notes" value={newCustomer.notes} onChange={(e) => handleInputChange(e)} rows={3}/>
                  </div>
                </div>
              </tabs_1.TabsContent>

              <tabs_1.TabsContent value="preferences" className="space-y-4 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label_1.Label htmlFor="allergies">Allergies</label_1.Label>
                    <textarea_1.Textarea id="allergies" name="allergies" value={newCustomer.allergies} onChange={(e) => handleInputChange(e)} placeholder="e.g., Peanuts, Shellfish, etc." rows={2}/>
                  </div>

                  <div className="space-y-2">
                    <label_1.Label htmlFor="dietaryRestrictions">Dietary Restrictions</label_1.Label>
                    <textarea_1.Textarea id="dietaryRestrictions" name="dietaryRestrictions" value={newCustomer.dietaryRestrictions} onChange={(e) => handleInputChange(e)} placeholder="e.g., Vegetarian, Gluten-free, etc." rows={2}/>
                  </div>

                  <div className="space-y-2">
                    <label_1.Label htmlFor="favoriteItems">Favorite Items</label_1.Label>
                    <textarea_1.Textarea id="favoriteItems" name="favoriteItems" value={newCustomer.favoriteItems} onChange={(e) => handleInputChange(e)} placeholder="e.g., Steak medium-rare, Chocolate cake, etc." rows={2}/>
                  </div>
                </div>
              </tabs_1.TabsContent>
            </tabs_1.Tabs>

            <div className="flex justify-end space-x-2">
              <button_1.Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </button_1.Button>
              <button_1.Button onClick={handleAddCustomer}>Add Customer</button_1.Button>
            </div>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>
      </div>

      <scroll_area_1.ScrollArea className="h-[500px]">
        {state.loading ? (<div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>) : state.customers.length === 0 ? (<div className="flex h-32 items-center justify-center text-muted-foreground">
            {searchQuery ? "No customers found matching your search" : "No customers in the database"}
          </div>) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.customers.map((customer) => (<card_1.Card key={customer.id}>
                <card_1.CardHeader className="pb-2">
                  <card_1.CardTitle className="text-lg">{customer.name}</card_1.CardTitle>
                </card_1.CardHeader>
                <card_1.CardContent>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                      {customer.phone && <div className="text-muted-foreground">{customer.phone}</div>}
                      {customer.email && <div className="text-muted-foreground">{customer.email}</div>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <badge_1.Badge variant="outline" className="bg-blue-50 text-blue-800">
                        {customer.visitCount} visits
                      </badge_1.Badge>
                      <badge_1.Badge variant="outline" className="bg-green-50 text-green-800">
                        ${(customer.totalSpent / 100).toFixed(2)} spent
                      </badge_1.Badge>
                      {customer.lastVisit && (<badge_1.Badge variant="outline" className="bg-purple-50 text-purple-800">
                          Last visit: {(0, date_fns_1.format)(new Date(customer.lastVisit), "MMM d, yyyy")}
                        </badge_1.Badge>)}
                    </div>

                    {(customer.allergies || customer.dietaryRestrictions) && (<div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <lucide_react_1.AlertCircle className="h-4 w-4 text-red-500"/>
                          <span>Allergies & Restrictions</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {customer.allergies && <div>Allergies: {customer.allergies}</div>}
                          {customer.dietaryRestrictions && <div>Dietary: {customer.dietaryRestrictions}</div>}
                        </div>
                      </div>)}

                    {customer.favoriteItems && (<div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <lucide_react_1.Heart className="h-4 w-4 text-red-500"/>
                          <span>Favorites</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{customer.favoriteItems}</div>
                      </div>)}

                    {customer.seatingPreferences && (<div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <lucide_react_1.Star className="h-4 w-4 text-amber-500"/>
                          <span>Seating</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{customer.seatingPreferences}</div>
                      </div>)}

                    {customer.notes && (<div className="space-y-1">
                        <div className="text-sm font-medium">Notes</div>
                        <div className="text-sm text-muted-foreground">{customer.notes}</div>
                      </div>)}

                    <div className="pt-2">
                      <dialog_1.Dialog>
                        <dialog_1.DialogTrigger asChild>
                          <button_1.Button variant="outline" size="sm" className="w-full" onClick={() => {
                    setSelectedCustomer(customer);
                    setIsEditDialogOpen(true);
                }}>
                            <lucide_react_1.Edit className="mr-2 h-4 w-4"/>
                            Edit Profile
                          </button_1.Button>
                        </dialog_1.DialogTrigger>
                        <dialog_1.DialogContent className="max-w-2xl">
                          <dialog_1.DialogHeader>
                            <dialog_1.DialogTitle>Edit Customer Profile</dialog_1.DialogTitle>
                          </dialog_1.DialogHeader>

                          {selectedCustomer && (<tabs_1.Tabs defaultValue="basic" className="w-full">
                              <tabs_1.TabsList className="grid w-full grid-cols-2">
                                <tabs_1.TabsTrigger value="basic">Basic Information</tabs_1.TabsTrigger>
                                <tabs_1.TabsTrigger value="preferences">Preferences & Allergies</tabs_1.TabsTrigger>
                              </tabs_1.TabsList>

                              <tabs_1.TabsContent value="basic" className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label_1.Label htmlFor="edit-name">Full Name</label_1.Label>
                                    <input_1.Input id="edit-name" name="name" value={selectedCustomer.name} onChange={(e) => handleInputChange(e, false)}/>
                                  </div>

                                  <div className="space-y-2">
                                    <label_1.Label htmlFor="edit-phone">Phone Number</label_1.Label>
                                    <input_1.Input id="edit-phone" name="phone" value={selectedCustomer.phone} onChange={(e) => handleInputChange(e, false)}/>
                                  </div>

                                  <div className="space-y-2">
                                    <label_1.Label htmlFor="edit-email">Email Address</label_1.Label>
                                    <input_1.Input id="edit-email" name="email" type="email" value={selectedCustomer.email} onChange={(e) => handleInputChange(e, false)}/>
                                  </div>

                                  <div className="space-y-2">
                                    <label_1.Label htmlFor="edit-seatingPreferences">Seating Preferences</label_1.Label>
                                    <input_1.Input id="edit-seatingPreferences" name="seatingPreferences" value={selectedCustomer.seatingPreferences} onChange={(e) => handleInputChange(e, false)}/>
                                  </div>

                                  <div className="col-span-2 space-y-2">
                                    <label_1.Label htmlFor="edit-notes">General Notes</label_1.Label>
                                    <textarea_1.Textarea id="edit-notes" name="notes" value={selectedCustomer.notes} onChange={(e) => handleInputChange(e, false)} rows={3}/>
                                  </div>
                                </div>
                              </tabs_1.TabsContent>

                              <tabs_1.TabsContent value="preferences" className="space-y-4 py-4">
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <label_1.Label htmlFor="edit-allergies">Allergies</label_1.Label>
                                    <textarea_1.Textarea id="edit-allergies" name="allergies" value={selectedCustomer.allergies} onChange={(e) => handleInputChange(e, false)} rows={2}/>
                                  </div>

                                  <div className="space-y-2">
                                    <label_1.Label htmlFor="edit-dietaryRestrictions">Dietary Restrictions</label_1.Label>
                                    <textarea_1.Textarea id="edit-dietaryRestrictions" name="dietaryRestrictions" value={selectedCustomer.dietaryRestrictions} onChange={(e) => handleInputChange(e, false)} rows={2}/>
                                  </div>

                                  <div className="space-y-2">
                                    <label_1.Label htmlFor="edit-favoriteItems">Favorite Items</label_1.Label>
                                    <textarea_1.Textarea id="edit-favoriteItems" name="favoriteItems" value={selectedCustomer.favoriteItems} onChange={(e) => handleInputChange(e, false)} rows={2}/>
                                  </div>
                                </div>
                              </tabs_1.TabsContent>
                            </tabs_1.Tabs>)}

                          <div className="flex justify-end space-x-2">
                            <button_1.Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                              Cancel
                            </button_1.Button>
                            <button_1.Button onClick={handleUpdateCustomer}>Update Customer</button_1.Button>
                          </div>
                        </dialog_1.DialogContent>
                      </dialog_1.Dialog>
                    </div>
                  </div>
                </card_1.CardContent>
              </card_1.Card>))}
          </div>)}
      </scroll_area_1.ScrollArea>
    </div>);
}
