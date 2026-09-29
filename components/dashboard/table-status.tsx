"use client"

import type { Table } from "@/types"

interface TableStatusProps {
  tables: Table[]
}

export function TableStatus({ tables }: TableStatusProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500"
      case "occupied":
        return "bg-red-500"
      case "reserved":
        return "bg-blue-500"
      case "dirty":
        return "bg-yellow-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-6">
      {tables.map((table) => (
        <div
          key={table.id}
          className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border bg-white p-2 shadow-sm"
        >
          <div className={`h-2 w-2 rounded-full ${getStatusColor(table.status)}`} />
          <span className="text-lg font-medium">{table.number}</span>
          <span className="text-xs text-muted-foreground">{table.capacity}</span>
        </div>
      ))}
    </div>
  )
}
