// Platform types re-export the canonical domain types from "@/types".
// The per-domain split files were empty scaffolding; keep this barrel so
// `import ... from "@/types/platform"` resolves without dead files.
export type {
  Customer,
  Reservation,
  Order,
  OrderStatus,
  MenuItem,
  MenuCategory,
  Promotion,
  Location,
  PaymentDetails,
  Table,
  TableStatus,
} from "@/types"
