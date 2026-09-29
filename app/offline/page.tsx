"use client"

import { Button } from "@/components/ui/button"
import { WifiOff, RefreshCw } from "lucide-react"
import Link from "next/link"

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center space-y-6 text-center">
        <div className="rounded-full bg-muted p-6">
          <WifiOff className="h-12 w-12 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">You&apos;re offline</h1>
          <p className="text-muted-foreground">
            It looks like you&apos;ve lost your internet connection. Some features may be limited until you&apos;re back online.
          </p>
        </div>

        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={() => {
              window.location.reload()
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>

          <Link href="/dashboard" passHref>
            <Button variant="outline" className="w-full">
              Go to Dashboard
            </Button>
          </Link>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Don&apos;t worry, any changes you make while offline will be saved and synced when you&apos;re back online.</p>
        </div>
      </div>
    </div>
  )
}
