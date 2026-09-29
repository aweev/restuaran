"use client"

import { useKitchen } from "@/context/KitchenContext"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export function KitchenNotificationSettings() {
  const { state, updateNotificationSettings } = useKitchen()

  const handleToggleNotification = (key: keyof typeof state.notificationSettings) => {
    updateNotificationSettings({
      [key]: !state.notificationSettings[key],
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" title="Notification Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-medium">Notification Settings</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="newOrder"
                checked={state.notificationSettings.newOrder}
                onCheckedChange={() => handleToggleNotification("newOrder")}
              />
              <Label htmlFor="newOrder">New Order Notifications</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="orderUpdated"
                checked={state.notificationSettings.orderUpdated}
                onCheckedChange={() => handleToggleNotification("orderUpdated")}
              />
              <Label htmlFor="orderUpdated">Order Updated Notifications</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="orderCancelled"
                checked={state.notificationSettings.orderCancelled}
                onCheckedChange={() => handleToggleNotification("orderCancelled")}
              />
              <Label htmlFor="orderCancelled">Order Cancelled Notifications</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="orderExpedite"
                checked={state.notificationSettings.orderExpedite}
                onCheckedChange={() => handleToggleNotification("orderExpedite")}
              />
              <Label htmlFor="orderExpedite">Expedite Order Notifications</Label>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
