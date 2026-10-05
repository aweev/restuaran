import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",

        /* --- Status tones ---------------------------------------------------
           One language across tables, orders and the KDS. Each pairs a
           background with a legible foreground, so meaning survives a
           glance, a projector, and a colour-vision deficiency (the dot and
           the label carry it too — colour is never the only signal). */
        "status-available":
          "border-transparent bg-status-available/12 text-status-available ring-1 ring-inset ring-status-available/30",
        "status-occupied":
          "border-transparent bg-status-occupied/12 text-status-occupied ring-1 ring-inset ring-status-occupied/30",
        "status-reserved":
          "border-transparent bg-status-reserved/12 text-status-reserved ring-1 ring-inset ring-status-reserved/30",
        "status-dirty":
          "border-transparent bg-status-dirty/14 text-status-dirty ring-1 ring-inset ring-status-dirty/35",
        "status-pending":
          "border-transparent bg-status-pending/14 text-status-pending ring-1 ring-inset ring-status-pending/35",
        "status-preparing":
          "border-transparent bg-status-preparing/12 text-status-preparing ring-1 ring-inset ring-status-preparing/30",
        "status-ready":
          "border-transparent bg-status-ready/12 text-status-ready ring-1 ring-inset ring-status-ready/30",
        "status-served":
          "border-transparent bg-status-served/12 text-status-served ring-1 ring-inset ring-status-served/30",
        "status-completed":
          "border-transparent bg-status-completed/12 text-status-completed ring-1 ring-inset ring-status-completed/30",
        "status-cancelled":
          "border-transparent bg-status-cancelled/12 text-status-cancelled ring-1 ring-inset ring-status-cancelled/30",
        "status-out-of-service":
          "border-transparent bg-status-out-of-service/12 text-status-out-of-service ring-1 ring-inset ring-status-out-of-service/30",

        /* Solid variants, for the KDS where the tile background is the signal. */
        "solid-ready":
          "border-transparent bg-status-ready text-white font-semibold",
        "solid-overdue":
          "border-transparent bg-status-cancelled text-white font-semibold",

        /* Live / offline connection indicator. */
        live:
          "border-transparent bg-status-available/12 text-status-available ring-1 ring-inset ring-status-available/30",
        offline:
          "border-status-dirty/40 bg-status-dirty/10 text-status-dirty ring-1 ring-inset ring-status-dirty/30",
      },
      size: {
        default: "",
        sm: "px-1.5 py-0 text-[10px]",
        /* For a screen read across a kitchen. */
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
