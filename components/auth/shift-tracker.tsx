"use client"

import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Clock, PlayCircle, StopCircle } from "lucide-react"
import { formatDuration } from "@/lib/auth"

export function ShiftTracker() {
  const { state, startShift, endShift } = useAuth()
  const { user, currentShift } = state

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every minute
  useState(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(interval)
  })

  const handleStartShift = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await startShift()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else if (typeof err === "string") {
        setError(err)
      } else {
        setError("Failed to start shift")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndShift = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await endShift()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else if (typeof err === "string") {
        setError(err)
      } else {
        setError("Failed to end shift")
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Shift Tracker</CardTitle>
        <CardDescription>Track your working hours</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {currentShift ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <Clock className="h-5 w-5" />
                <span className="font-medium">Shift in progress</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Started at</p>
                  <p className="font-medium">
                    {new Date(currentShift.startTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{formatDuration(currentShift.startTime, currentTime.toISOString())}</p>
                </div>
              </div>

              <Button variant="destructive" className="w-full" onClick={handleEndShift} disabled={isLoading}>
                <StopCircle className="mr-2 h-4 w-4" />
                {isLoading ? "Ending shift..." : "End Shift"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-5 w-5" />
                <span>No active shift</span>
              </div>

              <Button variant="default" className="w-full" onClick={handleStartShift} disabled={isLoading}>
                <PlayCircle className="mr-2 h-4 w-4" />
                {isLoading ? "Starting shift..." : "Start Shift"}
              </Button>
            </div>
          )}

          {user.shifts && user.shifts.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="font-medium">Recent Shifts</h3>
              <div className="space-y-2">
                {user.shifts
                  .filter((shift) => shift.id !== currentShift?.id)
                  .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                  .slice(0, 5)
                  .map((shift) => (
                    <div key={shift.id} className="flex justify-between items-center py-2 border-b">
                      <div>
                        <p className="text-sm">{new Date(shift.startTime).toLocaleDateString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(shift.startTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {shift.endTime &&
                            ` - ${new Date(shift.endTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {shift.hoursWorked ? `${shift.hoursWorked} hrs` : "In progress"}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
