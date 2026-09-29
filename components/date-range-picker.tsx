"use client"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateRangePickerProps {
  /** Controlled range used by the `date` / `onDateChange` API. */
  date?: DateRange | undefined
  onDateChange?: (date: DateRange | undefined) => void
  /** Controlled endpoints used by the `from` / `to` / `onFromChange` / `onToChange` API. */
  from?: Date
  to?: Date
  onFromChange?: (date: Date) => void
  onToChange?: (date: Date) => void
  className?: string
}

export function DateRangePicker({
  date,
  onDateChange,
  from,
  to,
  onFromChange,
  onToChange,
  className,
}: DateRangePickerProps) {
  // Support both call styles: if only `from`/`to` are supplied, derive the range from them.
  const hasEndpointApi = from !== undefined || to !== undefined || !!onFromChange || !!onToChange
  const selectedRange: DateRange | undefined = hasEndpointApi
    ? from || to
      ? { from, to }
      : undefined
    : date

  const label = selectedRange?.from
    ? selectedRange.to
      ? `${format(selectedRange.from, "LLL dd, y")} - ${format(selectedRange.to, "LLL dd, y")}`
      : format(selectedRange.from, "LLL dd, y")
    : "Pick a date"

  const handleSelect = (selected: DateRange | undefined) => {
    if (hasEndpointApi) {
      if (selected?.from && onFromChange) onFromChange(selected.from)
      if (selected?.to && onToChange) onToChange(selected.to)
      return
    }
    onDateChange?.(selected)
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn("w-[300px] justify-start text-left font-normal", !selectedRange?.from && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={selectedRange?.from}
            selected={selectedRange}
            onSelect={handleSelect}
            numberOfMonths={2}
            required={false}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
