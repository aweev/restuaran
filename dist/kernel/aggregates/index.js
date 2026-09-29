"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformOrderId = exports.PlatformOrderAggregate = exports.StaffShiftAggregate = exports.MenuItemAggregate = exports.WaitlistAggregate = exports.ReservationAggregate = exports.InventoryItemAggregate = exports.TableAggregate = exports.OrderAggregate = void 0;
const inventory_aggregate_1 = require("./inventory.aggregate");
Object.defineProperty(exports, "InventoryItemAggregate", { enumerable: true, get: function () { return inventory_aggregate_1.InventoryItemAggregate; } });
const menu_aggregate_1 = require("./menu.aggregate");
Object.defineProperty(exports, "MenuItemAggregate", { enumerable: true, get: function () { return menu_aggregate_1.MenuItemAggregate; } });
const order_aggregate_1 = require("./order.aggregate");
Object.defineProperty(exports, "OrderAggregate", { enumerable: true, get: function () { return order_aggregate_1.OrderAggregate; } });
const platform_order_aggregate_1 = require("./platform-order.aggregate");
Object.defineProperty(exports, "PlatformOrderAggregate", { enumerable: true, get: function () { return platform_order_aggregate_1.PlatformOrderAggregate; } });
const reservation_aggregate_1 = require("./reservation.aggregate");
Object.defineProperty(exports, "ReservationAggregate", { enumerable: true, get: function () { return reservation_aggregate_1.ReservationAggregate; } });
const shift_aggregate_1 = require("./shift.aggregate");
Object.defineProperty(exports, "StaffShiftAggregate", { enumerable: true, get: function () { return shift_aggregate_1.StaffShiftAggregate; } });
const table_aggregate_1 = require("./table.aggregate");
Object.defineProperty(exports, "TableAggregate", { enumerable: true, get: function () { return table_aggregate_1.TableAggregate; } });
const waitlist_aggregate_1 = require("./waitlist.aggregate");
Object.defineProperty(exports, "WaitlistAggregate", { enumerable: true, get: function () { return waitlist_aggregate_1.WaitlistAggregate; } });
const registry_1 = require("./registry");
(0, registry_1.registerAggregate)(order_aggregate_1.OrderAggregate.TYPE, order_aggregate_1.OrderAggregate);
(0, registry_1.registerAggregate)(table_aggregate_1.TableAggregate.TYPE, table_aggregate_1.TableAggregate);
(0, registry_1.registerAggregate)(inventory_aggregate_1.InventoryItemAggregate.TYPE, inventory_aggregate_1.InventoryItemAggregate);
// Phase 2 domain aggregates; their modules also re-register idempotently.
(0, registry_1.registerAggregate)(reservation_aggregate_1.ReservationAggregate.TYPE, reservation_aggregate_1.ReservationAggregate);
(0, registry_1.registerAggregate)(waitlist_aggregate_1.WaitlistAggregate.TYPE, waitlist_aggregate_1.WaitlistAggregate);
(0, registry_1.registerAggregate)(menu_aggregate_1.MenuItemAggregate.TYPE, menu_aggregate_1.MenuItemAggregate);
(0, registry_1.registerAggregate)(shift_aggregate_1.StaffShiftAggregate.TYPE, shift_aggregate_1.StaffShiftAggregate);
// Phase 3: marketplace order injection.
(0, registry_1.registerAggregate)(platform_order_aggregate_1.PlatformOrderAggregate.TYPE, platform_order_aggregate_1.PlatformOrderAggregate);
var platform_order_aggregate_2 = require("./platform-order.aggregate");
Object.defineProperty(exports, "platformOrderId", { enumerable: true, get: function () { return platform_order_aggregate_2.platformOrderId; } });
__exportStar(require("./aggregate"), exports);
__exportStar(require("./registry"), exports);
__exportStar(require("./repository"), exports);
