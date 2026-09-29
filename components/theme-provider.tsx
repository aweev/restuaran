"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"
import { useLocalStorage } from "@/hooks/useLocalStorage"

export interface CustomThemeProviderProps extends ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children, ...props }: CustomThemeProviderProps) {
  const [themeColors] = useLocalStorage("pos-theme-colors", {
    primary: "142.1 76.2% 36.3%",
    secondary: "142.1 76.2% 36.3%",
    accent: "210 40% 96.1%",
  })

  // Apply custom theme colors to CSS variables
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const root = document.documentElement
      Object.entries(themeColors).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value)
      })
    }
  }, [themeColors])

  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange {...props}>
      {children}
    </NextThemesProvider>
  )
}

export function useCustomTheme() {
  const [themeColors, setThemeColors] = useLocalStorage("pos-theme-colors", {
    primary: "142.1 76.2% 36.3%",
    secondary: "142.1 76.2% 36.3%",
    accent: "210 40% 96.1%",
  })

  const updateThemeColor = (colorKey: string, value: string) => {
    setThemeColors((prev) => ({
      ...prev,
      [colorKey]: value,
    }))
  }

  return {
    themeColors,
    updateThemeColor,
    resetThemeColors: () =>
      setThemeColors({
        primary: "142.1 76.2% 36.3%",
        secondary: "142.1 76.2% 36.3%",
        accent: "210 40% 96.1%",
      }),
  }
}
