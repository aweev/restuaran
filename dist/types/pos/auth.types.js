"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = void 0;
exports.ROLE_PERMISSIONS = {
    owner: [
        // Essentially all permissions
        "dashboard:view", "business_profile:view", "business_profile:edit", "location:view", "location:create", "location:edit", "location:delete", "location_settings:edit", "menu:view", "menu:create_items", "menu:edit_items", "menu:delete_items", "menu:manage_categories", "menu:manage_modifiers", "menu:set_availability", "menu:set_pricing", "order:view_all", "order:create", "order:edit_any", "order:cancel_any", "order:apply_discount_item", "order:apply_discount_order", "order:process_payment", "order:issue_refund", "order:split_bill", "order:transfer_items", "order:change_status", "table_layout:view", "table_layout:edit", "table:view_status", "table:change_status", "table:assign_to_order", "table:assign_server", "customer:view", "customer:create", "customer:edit", "customer:delete", "customer:view_order_history", "loyalty:manage_points", "user:view_list", "user:view_details", "user:create", "user:edit_profile", "user:delete", "user:assign_role", "user:manage_permissions", "user:manage_shifts", "user:reset_password", "report:view_sales", "report:view_inventory", "report:view_staff_performance", "report:view_financial", "report:export_data", "inventory:view_stock", "inventory:manage_ingredients", "inventory:perform_stock_take", "inventory:record_wastage", "inventory:manage_purchase_orders", "inventory:manage_vendors", "reservation:view", "reservation:create", "reservation:edit", "reservation:cancel", "reservation:seat_party", "waitlist:manage", "promotion:view", "promotion:create", "promotion:edit", "promotion:activate_deactivate", "expense:manage", "tax_settings:manage", "accounting_integration:manage", "payout:view", "system_settings:view", "system_settings:edit", "printer_settings:manage", "device_settings:manage", "internal_communication:send_messages", "dynamic_pricing_rules:manage", "audit_log:view",
    ],
    admin: [
        "dashboard:view", "location:view", "location:create", "location:edit", "location:delete", "location_settings:edit", "menu:view", "menu:create_items", "menu:edit_items", "menu:delete_items", "menu:manage_categories", "menu:manage_modifiers", "menu:set_availability", "menu:set_pricing", "order:view_all", "order:create", "order:edit_any", "order:cancel_any", "order:apply_discount_item", "order:apply_discount_order", "order:process_payment", "order:issue_refund", "order:split_bill", "order:transfer_items", "order:change_status", "table_layout:view", "table_layout:edit", "table:view_status", "table:change_status", "table:assign_to_order", "table:assign_server", "customer:view", "customer:create", "customer:edit", "customer:delete", "customer:view_order_history", "loyalty:manage_points", "user:view_list", "user:view_details", "user:create", "user:edit_profile", "user:delete", "user:assign_role", "user:manage_permissions", "user:manage_shifts", "user:reset_password", "report:view_sales", "report:view_inventory", "report:view_staff_performance", "report:view_financial", "report:export_data", "inventory:view_stock", "inventory:manage_ingredients", "inventory:perform_stock_take", "inventory:record_wastage", "inventory:manage_purchase_orders", "inventory:manage_vendors", "reservation:view", "reservation:create", "reservation:edit", "reservation:cancel", "reservation:seat_party", "waitlist:manage", "promotion:view", "promotion:create", "promotion:edit", "promotion:activate_deactivate", "expense:manage", "tax_settings:manage", "accounting_integration:manage", "payout:view", "system_settings:view", "system_settings:edit", "printer_settings:manage", "device_settings:manage", "internal_communication:send_messages", "dynamic_pricing_rules:manage", "audit_log:view",
    ],
    manager: [
        "dashboard:view", "location:view", "location_settings:edit", "menu:view", "menu:edit_items", "menu:set_availability", "menu:set_pricing", "order:view_all", "order:create", "order:edit_any", "order:cancel_any", "order:apply_discount_order", "order:process_payment", "order:issue_refund", "order:split_bill", "order:transfer_items", "order:change_status", "table_layout:view", "table:view_status", "table:change_status", "table:assign_to_order", "table:assign_server", "customer:view", "customer:edit", "customer:view_order_history", "user:view_list", "user:view_details", "user:edit_own_profile", "user:manage_shifts", "report:view_sales", "report:view_inventory", "report:view_staff_performance", "inventory:view_stock", "inventory:perform_stock_take", "inventory:record_wastage", "inventory:manage_purchase_orders", "reservation:view", "reservation:create", "reservation:edit", "reservation:cancel", "reservation:seat_party", "waitlist:manage", "promotion:view", "promotion:edit", "expense:manage", "internal_communication:send_messages", "audit_log:view",
    ],
    shift_lead: [
        "dashboard:view", "menu:view", "menu:set_availability", "order:view_all", "order:create", "order:edit_own", "order:cancel_own", "order:apply_discount_item", "order:process_payment", "order:split_bill", "order:transfer_items", "order:change_status", "table:view_status", "table:change_status", "table:assign_to_order", "table:assign_server", "report:view_sales", "inventory:view_stock", "inventory:record_wastage", "reservation:view", "reservation:edit", "waitlist:manage", "internal_communication:send_messages",
    ],
    waiter: [
        "menu:view", "order:view_assigned", "order:create", "order:edit_own", "order:cancel_own", "order:change_status", "table:view_status", "table:assign_to_order", "reservation:view", "internal_communication:send_messages",
    ],
    cashier: [
        "menu:view", "order:view_all", "order:process_payment", "order:issue_refund", "order:apply_discount_order", "order:split_bill", "table:view_status", "internal_communication:send_messages",
    ],
    bartender: [
        "menu:view", "order:view_assigned", "order:create", "order:edit_own", "order:change_status", "inventory:view_stock", "inventory:record_wastage", // Bar specific inventory
        "internal_communication:send_messages",
    ],
    kitchen_staff: [
        "menu:view", "order:view_all", // View orders on KDS
        "order:change_status", // Update item/order status (e.g., preparing -> ready)
        "inventory:view_stock", "internal_communication:send_messages",
    ],
    delivery_driver: [
        "order:view_assigned", // View orders assigned for delivery
        "order:change_status", // Update delivery status
        "internal_communication:send_messages",
    ],
    host_staff: [
        "table_layout:view", "table:view_status", "table:change_status", "reservation:view", "reservation:create", "reservation:edit", "reservation:cancel", "reservation:seat_party", "waitlist:manage", "internal_communication:send_messages",
    ],
    back_office_staff: [
        "report:view_sales", "report:view_financial", "expense:manage", "payout:view", "audit_log:view",
    ],
    custom_role: [], // Starts with no permissions; all must be assigned directly
};
