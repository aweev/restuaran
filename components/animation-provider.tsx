"use client"

import type React from "react"
import { createContext, useContext, useState } from "react"
import { motion, type MotionProps, type Transition } from "framer-motion"

type AnimationPreset = "fade" | "slide" | "scale" | "none"

/** The subset of Framer Motion props these helpers produce. */
type AnimationProps = Pick<MotionProps, "initial" | "animate" | "exit">

interface AnimationContextType {
  animationsEnabled: boolean
  toggleAnimations: () => void
  animationSpeed: "slow" | "normal" | "fast"
  setAnimationSpeed: (speed: "slow" | "normal" | "fast") => void
  getAnimationProps: (preset: AnimationPreset) => AnimationProps
  getTransitionProps: () => Transition
}

const AnimationContext = createContext<AnimationContextType | undefined>(undefined)

export function AnimationProvider({ children }: { children: React.ReactNode }) {
  const [animationsEnabled, setAnimationsEnabled] = useState(true)
  const [animationSpeed, setAnimationSpeed] = useState<"slow" | "normal" | "fast">("normal")

  const toggleAnimations = () => {
    setAnimationsEnabled((prev) => !prev)
  }

  const getAnimationProps = (preset: AnimationPreset) => {
    if (!animationsEnabled || preset === "none") {
      return {}
    }

    switch (preset) {
      case "fade":
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        }
      case "slide":
        return {
          initial: { x: -20, opacity: 0 },
          animate: { x: 0, opacity: 1 },
          exit: { x: 20, opacity: 0 },
        }
      case "scale":
        return {
          initial: { scale: 0.9, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 0.9, opacity: 0 },
        }
      default:
        return {}
    }
  }

  const getTransitionProps = () => {
    if (!animationsEnabled) {
      return { duration: 0 }
    }

    const durations = {
      slow: 0.5,
      normal: 0.3,
      fast: 0.15,
    }

    return {
      duration: durations[animationSpeed],
      ease: "easeInOut",
    }
  }

  return (
    <AnimationContext.Provider
      value={{
        animationsEnabled,
        toggleAnimations,
        animationSpeed,
        setAnimationSpeed,
        getAnimationProps,
        getTransitionProps,
      }}
    >
      {children}
    </AnimationContext.Provider>
  )
}

export function useAnimation() {
  const context = useContext(AnimationContext)
  if (context === undefined) {
    throw new Error("useAnimation must be used within an AnimationProvider")
  }
  return context
}

export function AnimatedComponent({
  children,
  preset = "fade",
  className,
}: {
  children: React.ReactNode
  preset?: AnimationPreset
  className?: string
}) {
  const { getAnimationProps, getTransitionProps } = useAnimation()

  return (
    <motion.div {...getAnimationProps(preset)} transition={getTransitionProps()} className={className}>
      {children}
    </motion.div>
  )
}
