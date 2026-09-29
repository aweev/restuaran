types/
├── pos/ # Types specific to the Restaurant POS internal operations
│ ├── accounting.types.ts
│ ├── analytics.types.ts
│ ├── audit-log.types.ts
│ ├── auth.types.ts # Staff users, roles, permissions
│ ├── business-profile.types.ts # Overall business/restaurant entity
│ ├── cart.types.ts
│ ├── customer-feedback.types.ts # POS-side feedback collection
│ ├── customer.types.ts # POS-specific customer data, loyalty, restaurant-managed delivery
│ ├── device.types.ts # POS terminals, KDS
│ ├── dynamic-pricing.types.ts
│ ├── financial-internal.types.ts # Journal entries, chart of accounts (if advanced internal accounting)
│ ├── floor-plan.types.ts
│ ├── gift-card.types.ts # Restaurant-issued gift cards
│ ├── inventory.types.ts # Ingredients, stock, wastage reasons
│ ├── kitchen.types.ts
│ ├── leave-request.types.ts
│ ├── marketing.types.ts # Restaurant-specific promotions, customer segments
│ ├── menu.types.ts # Core MenuItem, modifiers, categories
│ ├── multi-location.types.ts
│ ├── notifications.types.ts # Internal POS notifications
│ ├── order.types.ts # Core Order, order items, POS order statuses
│ ├── payments.types.ts # PaymentDetails, POS discounts
│ ├── payroll.types.ts
│ ├── payout.types.ts # Settlements from payment processors
│ ├── printer.types.ts
│ ├── recipe.types.ts # MenuItem composition
│ ├── reservations.types.ts # POS-managed reservations
│ ├── staff-management.types.ts
│ ├── stock-take.types.ts
│ ├── system-settings.types.ts # Global POS configurations
│ ├── table-management.types.ts
│ ├── time-clock.types.ts
│ ├── units-of-measure.types.ts
│ ├── vendor.types.ts
│ ├── waitlist.types.ts
│ └── index.ts # Barrel file for pos types
├── platform/ # Types for the customer-facing multi-restaurant platform
│ ├── diner-user.types.ts # Diner accounts, addresses, saved payments
│ ├── menu.types.ts # Platform-facing menu/item representation for search/compare
│ ├── order.types.ts # Orders placed through the platform
│ ├── promotion.types.ts # Platform-wide promotions
│ ├── reservation.types.ts # Reservations made via platform
│ ├── restaurant-profile.types.ts # Public restaurant profiles, delivery/pickup settings
│ ├── review.types.ts # Diner reviews for restaurants/items
│ └── index.ts # Barrel file for platform types
├── shared/ # Types shared between POS and Platform, or general utilities
│ ├── common.types.ts # e.g., PaymentGateway, DiningMode, FoodType, PaymentStatus
│ ├── socket-events.types.ts # Socket event constants and type definitions
│ └── index.ts # Barrel file for shared types
└── index.ts # Main barrel file for all types

# Create the main types directory if it doesn't exist

mkdir -p types

# Create POS specific type files and its barrel file

mkdir -p types/pos
touch types/pos/accounting.types.ts \
 types/pos/analytics.types.ts \
 types/pos/audit-log.types.ts \
 types/pos/auth.types.ts \
 types/pos/business-profile.types.ts \
 types/pos/cart.types.ts \
 types/pos/customer-feedback.types.ts \
 types/pos/customer.types.ts \
 types/pos/device.types.ts \
 types/pos/dynamic-pricing.types.ts \
 types/pos/financial-internal.types.ts \
 types/pos/floor-plan.types.ts \
 types/pos/gift-card.types.ts \
 types/pos/inventory.types.ts \
 types/pos/kitchen.types.ts \
 types/pos/leave-request.types.ts \
 types/pos/marketing.types.ts \
 types/pos/menu.types.ts \
 types/pos/multi-location.types.ts \
 types/pos/notifications.types.ts \
 types/pos/order.types.ts \
 types/pos/payments.types.ts \
 types/pos/payroll.types.ts \
 types/pos/payout.types.ts \
 types/pos/printer.types.ts \
 types/pos/recipe.types.ts \
 types/pos/reservations.types.ts \
 types/pos/staff-management.types.ts \
 types/pos/stock-take.types.ts \
 types/pos/system-settings.types.ts \
 types/pos/table-management.types.ts \
 types/pos/time-clock.types.ts \
 types/pos/units-of-measure.types.ts \
 types/pos/vendor.types.ts \
 types/pos/waitlist.types.ts \
 types/pos/index.ts

# Create Platform specific type files and its barrel file

mkdir -p types/platform
touch types/platform/diner-user.types.ts \
 types/platform/menu.types.ts \
 types/platform/order.types.ts \
 types/platform/promotion.types.ts \
 types/platform/reservation.types.ts \
 types/platform/restaurant-profile.types.ts \
 types/platform/review.types.ts \
 types/platform/index.ts

# Create Shared type files and its barrel file

mkdir -p types/shared
touch types/shared/common.types.ts \
 types/shared/socket-events.types.ts \
 types/shared/index.ts

# Create the main barrel file for the types directory

touch types/index.ts

echo "Type files and directory structure created successfully!"
