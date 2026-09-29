"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KitchenNotificationSettings = KitchenNotificationSettings;
const KitchenContext_1 = require("@/context/KitchenContext");
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
const popover_1 = require("@/components/ui/popover");
const checkbox_1 = require("@/components/ui/checkbox");
const label_1 = require("@/components/ui/label");
function KitchenNotificationSettings() {
    const { state, updateNotificationSettings } = (0, KitchenContext_1.useKitchen)();
    const handleToggleNotification = (key) => {
        updateNotificationSettings({
            [key]: !state.notificationSettings[key],
        });
    };
    return (<popover_1.Popover>
      <popover_1.PopoverTrigger asChild>
        <button_1.Button variant="outline" size="icon" title="Notification Settings">
          <lucide_react_1.Settings className="h-4 w-4"/>
        </button_1.Button>
      </popover_1.PopoverTrigger>
      <popover_1.PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-medium">Notification Settings</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <checkbox_1.Checkbox id="newOrder" checked={state.notificationSettings.newOrder} onCheckedChange={() => handleToggleNotification("newOrder")}/>
              <label_1.Label htmlFor="newOrder">New Order Notifications</label_1.Label>
            </div>
            <div className="flex items-center space-x-2">
              <checkbox_1.Checkbox id="orderUpdated" checked={state.notificationSettings.orderUpdated} onCheckedChange={() => handleToggleNotification("orderUpdated")}/>
              <label_1.Label htmlFor="orderUpdated">Order Updated Notifications</label_1.Label>
            </div>
            <div className="flex items-center space-x-2">
              <checkbox_1.Checkbox id="orderCancelled" checked={state.notificationSettings.orderCancelled} onCheckedChange={() => handleToggleNotification("orderCancelled")}/>
              <label_1.Label htmlFor="orderCancelled">Order Cancelled Notifications</label_1.Label>
            </div>
            <div className="flex items-center space-x-2">
              <checkbox_1.Checkbox id="orderExpedite" checked={state.notificationSettings.orderExpedite} onCheckedChange={() => handleToggleNotification("orderExpedite")}/>
              <label_1.Label htmlFor="orderExpedite">Expedite Order Notifications</label_1.Label>
            </div>
          </div>
        </div>
      </popover_1.PopoverContent>
    </popover_1.Popover>);
}
