"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

interface TourStepProps {
  step: {
    id: string
    title: string
    content: string
    target: string
    placement?: "top" | "right" | "bottom" | "left"
  }
  totalSteps: number
  currentStep: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}

export function TourStep({ step, totalSteps, currentStep, onNext, onPrev, onSkip }: TourStepProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [targetElement, setTargetElement] = useState<Element | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const target = document.querySelector(step.target)
    if (target) {
      setTargetElement(target)

      // Position the tooltip
      const updatePosition = () => {
        const rect = target.getBoundingClientRect()
        const tooltipRect = tooltipRef.current?.getBoundingClientRect()
        const tooltipWidth = tooltipRect?.width || 300
        const tooltipHeight = tooltipRect?.height || 150

        let top = 0
        let left = 0

        switch (step.placement) {
          case "top":
            top = rect.top - tooltipHeight - 10
            left = rect.left + rect.width / 2 - tooltipWidth / 2
            break
          case "right":
            top = rect.top + rect.height / 2 - tooltipHeight / 2
            left = rect.right + 10
            break
          case "bottom":
            top = rect.bottom + 10
            left = rect.left + rect.width / 2 - tooltipWidth / 2
            break
          case "left":
            top = rect.top + rect.height / 2 - tooltipHeight / 2
            left = rect.left - tooltipWidth - 10
            break
          default:
            top = rect.bottom + 10
            left = rect.left + rect.width / 2 - tooltipWidth / 2
        }

        // Ensure tooltip stays within viewport
        if (left < 10) left = 10
        if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10
        if (top < 10) top = 10
        if (top + tooltipHeight > window.innerHeight - 10) top = window.innerHeight - tooltipHeight - 10

        setPosition({ top, left })
      }

      updatePosition()

      // Highlight the target element
      target.setAttribute("data-tour-target", "true")

      // Update position on resize
      window.addEventListener("resize", updatePosition)

      return () => {
        target.removeAttribute("data-tour-target")
        window.removeEventListener("resize", updatePosition)
      }
    }
  }, [step])

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onSkip} />

      {/* Target highlight */}
      {targetElement && (
        <div
          className="fixed z-50 animate-pulse rounded-md ring-4 ring-primary"
          style={{
            top: targetElement.getBoundingClientRect().top,
            left: targetElement.getBoundingClientRect().left,
            width: targetElement.getBoundingClientRect().width,
            height: targetElement.getBoundingClientRect().height,
          }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence>
        <motion.div
          ref={tooltipRef}
          className="fixed z-50 w-[300px] rounded-lg border bg-card p-4 shadow-lg"
          style={{ top: position.top, left: position.left }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">{step.title}</h3>
            <Button variant="ghost" size="icon" onClick={onSkip} className="h-6 w-6">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">{step.content}</p>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {totalSteps}
            </div>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={onPrev}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
              )}
              <Button size="sm" onClick={onNext}>
                {currentStep === totalSteps - 1 ? "Finish" : "Next"}
                {currentStep !== totalSteps - 1 && <ChevronRight className="ml-1 h-4 w-4" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  )
}
