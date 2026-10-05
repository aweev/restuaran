import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // `pos-skeleton` is the travelling-highlight shimmer from globals.css.
      // A static pulse previously read as a stuck UI rather than as loading.
      className={cn("pos-skeleton rounded-md", className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }

