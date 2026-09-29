"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationCenter = NotificationCenter;
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const button_1 = require("@/components/ui/button");
const popover_1 = require("@/components/ui/popover");
const scroll_area_1 = require("@/components/ui/scroll-area");
function NotificationCenter() {
    const [notifications, setNotifications] = (0, react_1.useState)([
        {
            id: "1",
            title: "New Order #1042",
            message: "Table 4 placed a new order for 3 items.",
            time: "2m ago",
            read: false,
        },
        {
            id: "2",
            title: "Order Ready",
            message: "Order #1039 is ready for serving.",
            time: "10m ago",
            read: false,
        },
        {
            id: "3",
            title: "Table Reserved",
            message: "Reservation for party of 4 at 7:30 PM.",
            time: "25m ago",
            read: true,
        },
    ]);
    const unreadCount = notifications.filter((n) => !n.read).length;
    const markAllAsRead = () => {
        setNotifications((prev) => prev.map((n) => (Object.assign(Object.assign({}, n), { read: true }))));
    };
    const clearAll = () => {
        setNotifications([]);
    };
    return (<popover_1.Popover>
      <popover_1.PopoverTrigger asChild>
        <button_1.Button variant="ghost" size="icon" className="relative">
          <lucide_react_1.Bell className="h-5 w-5"/>
          {unreadCount > 0 && (<span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount}
            </span>)}
          <span className="sr-only">Open notifications</span>
        </button_1.Button>
      </popover_1.PopoverTrigger>
      <popover_1.PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (<button_1.Button variant="ghost" size="sm" className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground" onClick={markAllAsRead}>
                <lucide_react_1.Check className="mr-1 h-3 w-3"/> Mark read
              </button_1.Button>)}
            {notifications.length > 0 && (<button_1.Button variant="ghost" size="sm" className="h-auto p-1 text-xs text-muted-foreground hover:text-destructive" onClick={clearAll}>
                <lucide_react_1.Trash2 className="h-3 w-3"/>
              </button_1.Button>)}
          </div>
        </div>
        <scroll_area_1.ScrollArea className="h-72">
          {notifications.length === 0 ? (<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No notifications
            </div>) : (<div className="divide-y">
              {notifications.map((notification) => (<div key={notification.id} className={`p-3 text-xs transition-colors ${notification.read ? "bg-background" : "bg-muted/40 font-medium"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{notification.title}</span>
                    <span className="text-[10px] text-muted-foreground">{notification.time}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{notification.message}</p>
                </div>))}
            </div>)}
        </scroll_area_1.ScrollArea>
      </popover_1.PopoverContent>
    </popover_1.Popover>);
}
