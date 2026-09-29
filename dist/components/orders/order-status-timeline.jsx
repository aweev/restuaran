"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStatusTimeline = OrderStatusTimeline;
const react_1 = require("react");
const date_fns_1 = require("date-fns");
function OrderStatusTimeline({ order }) {
    const [events, setEvents] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        // In a real application, you would fetch the actual status change events
        // For now, we'll simulate them based on the order data
        const simulatedEvents = [
            {
                status: "created",
                timestamp: order.createdAt,
                description: "Order created",
            },
        ];
        // Add payment events
        order.payments.forEach((payment) => {
            simulatedEvents.push({
                status: "payment",
                timestamp: payment.timestamp,
                description: `Payment of $${payment.amount.toFixed(2)} received via ${payment.method}`,
            });
        });
        // Add status change events based on current status
        const statusFlow = ["pending", "preparing", "ready", "delivered", "completed"];
        const currentStatusIndex = statusFlow.indexOf(order.status);
        // For cancelled orders
        if (order.status === "cancelled") {
            simulatedEvents.push({
                status: "cancelled",
                timestamp: order.updatedAt,
                description: "Order cancelled",
            });
        }
        else {
            // For normal flow
            for (let i = 0; i <= currentStatusIndex; i++) {
                // Skip "created" since we already added it
                if (i === 0)
                    continue;
                const status = statusFlow[i];
                let description = "";
                switch (status) {
                    case "pending":
                        description = "Order received by kitchen";
                        break;
                    case "preparing":
                        description = "Kitchen started preparing the order";
                        break;
                    case "ready":
                        description = "Order is ready for pickup/delivery";
                        break;
                    case "delivered":
                        description = "Order delivered to customer";
                        break;
                    case "completed":
                        description = "Order completed";
                        break;
                }
                // For simplicity, we'll use updated timestamp for all events
                // In a real app, you'd have actual timestamps for each status change
                simulatedEvents.push({
                    status,
                    timestamp: i === currentStatusIndex ? order.updatedAt : order.createdAt,
                    description,
                });
            }
        }
        // Sort events by timestamp
        simulatedEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setEvents(simulatedEvents);
    }, [order]);
    if (events.length === 0) {
        return <div>Loading timeline...</div>;
    }
    return (<div className="space-y-4">
      <ol className="relative border-l border-gray-200 dark:border-gray-700">
        {events.map((event, index) => (<li key={index} className="mb-10 ml-6">
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 ring-8 ring-white dark:bg-blue-900 dark:ring-gray-900">
              <div className="h-3 w-3 rounded-full bg-blue-500 dark:bg-blue-400"/>
            </span>
            <h3 className="mb-1 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </h3>
            <time className="mb-2 block text-sm font-normal leading-none text-gray-400 dark:text-gray-500">
              {(0, date_fns_1.format)(new Date(event.timestamp), "PPpp")}
            </time>
            <p className="text-base font-normal text-gray-500 dark:text-gray-400">{event.description}</p>
          </li>))}
      </ol>
    </div>);
}
