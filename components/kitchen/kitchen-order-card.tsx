"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useOrder } from "@/context/OrderContext"
import { useKitchen } from "@/context/KitchenContext"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { formatDistanceToNow } from "date-fns"
import { Clock, AlertCircle, ChefHat, CheckCircle, Flame, PauseCircle, PlayCircle } from "lucide-react"
import type { Order } from "@/types"

interface KitchenOrderCardProps {
  order: Order
  onSelect: () => void
  prepTime: number
}

export function KitchenOrderCard({ order, onSelect, prepTime }: KitchenOrderCardProps) {
  const { updateOrderStatus } = useOrder()
  const { beginTicket, readyTicket, fireCourse, holdCourse, releaseCourse } = useKitchen()
  const [isUpdating, setIsUpdating] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  // Held courses are a kernel fact (projected onto the order), so a hold is
  // shared across every KDS terminal and survives a reload — not terminal-local.
  const heldCourses = order.heldCourses ?? []
  const isHeld = heldCourses.length > 0

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
      case "preparing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
      case "ready":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
    }
  }

  const getNextStatus = useCallback((currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return "preparing"
      case "preparing":
        return "ready"
      default:
        return null
    }
  }, [])

  const getNextStatusLabel = useCallback((currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return "Start Preparing"
      case "preparing":
        return "Mark Ready"
      default:
        return "Update Status"
    }
  }, [])

  const getNextStatusIcon = useCallback((currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return <ChefHat className="mr-2 h-4 w-4" />
      case "preparing":
        return <CheckCircle className="mr-2 h-4 w-4" />
      default:
        return null
    }
  }, [])

  // Group items by course
  const itemsByCourse = useCallback(() => {
    const courses: Record<number, typeof order.items> = {}
    for (const item of order.items) {
      const course = item.course ?? 1
      if (!courses[course]) courses[course] = []
      courses[course].push(item)
    }
    return courses
  }, [order])

  // Get unique courses in order
  const courses = useCallback(() => Object.keys(itemsByCourse()).map(Number).sort((a, b) => a - b), [itemsByCourse])

  const handleStatusUpdate = useCallback(async () => {
    const nextStatus = getNextStatus(order.status)
    if (!nextStatus) return

    setIsUpdating(true)
    try {
      const lineIds = order.items.map((i) => i.id)
      try {
        if (nextStatus === "preparing") await beginTicket(order.id, lineIds)
        else if (nextStatus === "ready") await readyTicket(order.id, lineIds)
        else await updateOrderStatus(order.id, nextStatus)
        return
      } catch (kernelError) {
        if ((kernelError as { code?: string }).code !== "AGGREGATE_NOT_FOUND") throw kernelError
      }
      await updateOrderStatus(order.id, nextStatus)
    } catch (error) {
      console.error("Error updating order status:", error)
    } finally {
      setIsUpdating(false)
    }
  }, [order, beginTicket, readyTicket, updateOrderStatus, getNextStatus])

  const handleFireCourse = useCallback(async (course: number) => {
    setIsUpdating(true)
    try {
      await fireCourse(order.id, course)
    } catch (error) {
      console.error("Error firing course:", error)
    } finally {
      setIsUpdating(false)
    }
  }, [order, fireCourse])

  const handleHoldCourse = useCallback(async (course: number) => {
    setIsUpdating(true)
    try {
      if ((order.heldCourses ?? []).includes(course)) await releaseCourse(order.id, course)
      else await holdCourse(order.id, course)
    } catch (error) {
      console.error("Error toggling course hold:", error)
    } finally {
      setIsUpdating(false)
    }
  }, [order.id, order.heldCourses, holdCourse, releaseCourse])

  // Bump bar keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if this card is focused or hovered
      if (!cardRef.current?.matches(":hover, :focus-within")) return

      const nextStatus = getNextStatus(order.status)
      if (!nextStatus) return

      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault()
          handleStatusUpdate()
          break
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          // Fire specific course with number keys
          const courseNum = Number(e.key)
          if (courses().includes(courseNum)) {
            e.preventDefault()
            handleFireCourse(courseNum)
          }
          break
        case "h":
        case "H":
          // Hold current course (first course by default)
          if (courses().length > 0) {
            e.preventDefault()
            handleHoldCourse(courses()[0])
          }
          break
        case "F":
          // Fire every held course
          e.preventDefault()
          ;(order.heldCourses ?? []).forEach((c) => handleFireCourse(c))
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [order.status, order.id, order.items, order.heldCourses, getNextStatus, beginTicket, readyTicket, updateOrderStatus, fireCourse, courses, handleStatusUpdate, handleFireCourse, handleHoldCourse])

  // Calculate how long the order has been in its current status
  const orderAge = formatDistanceToNow(new Date(order.updatedAt), { addSuffix: false })

  // Calculate if the order is urgent based on wait time vs prep time
  const waitTimeMinutes = (Date.now() - new Date(order.createdAt).getTime()) / 60000
  const isUrgent = order.status === "pending" && waitTimeMinutes > prepTime * 0.5
  const isCritical = order.status === "pending" && waitTimeMinutes > prepTime * 0.8

  // Calculate progress for preparing orders
  const progress = order.status === "preparing" ? Math.min(100, Math.round((waitTimeMinutes / prepTime) * 100)) : 0

  return (
    <Card
      ref={cardRef}
      tabIndex={0}
      className={`cursor-pointer transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        isCritical
          ? "border-red-500 bg-red-50 dark:bg-red-950/20"
          : isUrgent
            ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20"
            : ""
      } ${isHeld ? "ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}
      onClick={onSelect}
    >
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {order.tableId ? `Table ${order.tableId}` : order.customerName || "Takeaway"}
            {isHeld && <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">HELD</span>}
          </h3>
          <Badge variant="outline" className={getStatusColor(order.status)}>
            <span aria-hidden>{order.status === "pending" ? "● " : order.status === "preparing" ? "◐ " : "● "}</span>{order.status}
            <span className="sr-only">{order.status === "pending" ? " (waiting)" : order.status === "preparing" ? " (in progress)" : order.status === "ready" ? " (done)" : ""}</span>
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{orderAge}</span>
          {isUrgent && (
            <span className={`ml-2 flex items-center ${isCritical ? "text-red-500" : "text-orange-500"}`}>
              <AlertCircle className="mr-1 h-3 w-3" />
              {isCritical ? "Critical" : "Urgent"}
            </span>
          )}
          {isHeld && (
            <span className="ml-2 flex items-center text-amber-600">
              <PauseCircle className="mr-1 h-3 w-3" />
              Course {heldCourses.join(", ")} held
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span>Items: {order.items.length}</span>
            <span>Est. prep: {prepTime} min</span>
          </div>

          {order.status === "preparing" && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Started</span>
                <span>{progress}% complete</span>
              </div>
            </div>
          )}

          {/* Course sections */}
          {courses().length > 1 && (
            <div className="space-y-2 mt-2">
              {courses().map((courseNum) => {
                const courseItems = itemsByCourse()[courseNum]
                const isCourseHeld = heldCourses.includes(courseNum)
                return (
                  <div key={courseNum} className={`p-2 rounded-lg border ${isCourseHeld ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "border-gray-200 dark:border-gray-700"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">Course {courseNum}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant={isCourseHeld ? "default" : "outline"}
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleHoldCourse(courseNum)
                          }}
                          disabled={isUpdating}
                          aria-label={isCourseHeld ? `Release course ${courseNum}` : `Hold course ${courseNum}`}
                        >
                          {isCourseHeld ? <PlayCircle className="h-3 w-3" /> : <PauseCircle className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFireCourse(courseNum)
                          }}
                          disabled={isUpdating}
                          aria-label={`Fire course ${courseNum}`}
                        >
                          <Flame className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      {courseItems.slice(0, 2).map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${item.type === "Veg" ? "bg-green-500" : "bg-red-500"}`}></span>
                            <span className="truncate">{item.title}</span>
                          </div>
                          <span className="font-medium">x{item.quantity}</span>
                        </div>
                      ))}
                      {courseItems.length > 2 && (
                        <div className="text-xs text-muted-foreground">+{courseItems.length - 2} more items</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Non-coursed items (legacy or single-course) */}
          {courses().length <= 1 && (
            <div className="space-y-1">
              {order.items.slice(0, 3).map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${item.type === "Veg" ? "bg-green-500" : "bg-red-500"}`}></span>
                    <span className="truncate">{item.title}</span>
                  </div>
                  <span className="font-medium">x{item.quantity}</span>
                </div>
              ))}
              {order.items.length > 3 && (
                <div className="text-xs text-muted-foreground">+{order.items.length - 3} more items</div>
              )}
            </div>
          )}

          {order.notes && (
            <div className="mt-2 rounded-md bg-amber-50 p-1.5 text-xs dark:bg-amber-950/30">
              <p className="font-medium">Notes:</p>
              <p className="text-muted-foreground">{order.notes}</p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-3 pt-0 space-y-2">
        {/* Primary action */}
        {getNextStatus(order.status) && (
          <Button
            className="min-h-[44px] w-full text-base"
            aria-label={`${getNextStatusLabel(order.status)} for order ${order.id.slice(0, 8)}`}
            onClick={(e) => {
              e.stopPropagation()
              handleStatusUpdate()
            }}
            disabled={isUpdating || isHeld}
            variant={isCritical ? "destructive" : isUrgent ? "default" : "outline"}
            size="sm"
          >
            {getNextStatusIcon(order.status)}
            {isUpdating ? "Updating..." : getNextStatusLabel(order.status)}
          </Button>
        )}

        {/* Bump bar shortcuts hint */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono">Enter/Space</kbd>
            <span>{getNextStatusLabel(order.status)}</span>
          </span>
          {courses().length > 1 && (
            <span className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono">1-5</kbd>
              <span>Fire course</span>
            </span>
          )}
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono">H</kbd>
            <span>Hold</span>
          </span>
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono">F</kbd>
            <span>Fire held</span>
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}