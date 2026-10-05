"use client"

interface AnalyticsHeaderProps {
  title: string
  description?: string
}

export function AnalyticsHeader({ title, description }: AnalyticsHeaderProps) {
  return (
    <div className="space-y-1">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
  )
}
