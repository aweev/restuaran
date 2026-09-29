"use client"

import type React from "react"
import { createContext, useContext, useState } from "react"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { TourStep } from "@/components/guided-tour/tour-step"

interface TourStepType {
  id: string
  title: string
  content: string
  target: string
  placement?: "top" | "right" | "bottom" | "left"
}

interface TourContextType {
  currentTour: string | null
  currentStep: number
  startTour: (tourId: string) => void
  endTour: () => void
  nextStep: () => void
  prevStep: () => void
  skipTour: () => void
  completedTours: string[]
  resetTours: () => void
}

const TourContext = createContext<TourContextType | undefined>(undefined)

// Define available tours
const tours: Record<string, TourStepType[]> = {
  dashboard: [
    {
      id: "dashboard-welcome",
      title: "Welcome to the Dashboard",
      content: "This is your main dashboard where you can see an overview of your restaurant's performance.",
      target: "#dashboard-overview",
      placement: "bottom",
    },
    {
      id: "recent-orders",
      title: "Recent Orders",
      content: "Here you can see the most recent orders placed in your restaurant.",
      target: "#recent-orders",
      placement: "right",
    },
    {
      id: "table-status",
      title: "Table Status",
      content: "This section shows the current status of all tables in your restaurant.",
      target: "#table-status",
      placement: "left",
    },
  ],
  orders: [
    {
      id: "orders-welcome",
      title: "Order Management",
      content: "This is where you can manage all orders for your restaurant.",
      target: "#orders-header",
      placement: "bottom",
    },
    {
      id: "create-order",
      title: "Create New Orders",
      content: "Click here to create a new order for a customer.",
      target: "#create-order-button",
      placement: "right",
    },
    {
      id: "order-filters",
      title: "Filter Orders",
      content: "Use these filters to find specific orders quickly.",
      target: "#order-filters",
      placement: "bottom",
    },
  ],
  // Add more tours as needed
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [currentTour, setCurrentTour] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedTours, setCompletedTours] = useLocalStorage<string[]>("pos-completed-tours", [])

  const startTour = (tourId: string) => {
    if (tours[tourId]) {
      setCurrentTour(tourId)
      setCurrentStep(0)
    }
  }

  const endTour = () => {
    if (currentTour) {
      setCompletedTours((prev) => [...prev, currentTour])
      setCurrentTour(null)
      setCurrentStep(0)
    }
  }

  const nextStep = () => {
    if (currentTour && currentStep < tours[currentTour].length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      endTour()
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const skipTour = () => {
    if (currentTour) {
      setCompletedTours((prev) => [...prev, currentTour])
      setCurrentTour(null)
      setCurrentStep(0)
    }
  }

  const resetTours = () => {
    setCompletedTours([])
  }

  return (
    <TourContext.Provider
      value={{
        currentTour,
        currentStep,
        startTour,
        endTour,
        nextStep,
        prevStep,
        skipTour,
        completedTours,
        resetTours,
      }}
    >
      {children}
      {currentTour && tours[currentTour] && (
        <TourStep
          step={tours[currentTour][currentStep]}
          totalSteps={tours[currentTour].length}
          currentStep={currentStep}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
        />
      )}
    </TourContext.Provider>
  )
}

export function useTour() {
  const context = useContext(TourContext)
  if (context === undefined) {
    throw new Error("useTour must be used within a TourProvider")
  }
  return context
}
