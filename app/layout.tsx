import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { UiProvider } from "@/components/ui-preferences"
// The kernel client bridge. Mounted *outside* AuthProvider so that a failed
// kernel call degrades on its own terms rather than tearing down auth state.
import { KernelProvider } from "@/kernel/react/kernel-provider"
import { AuthProvider } from "@/context/AuthContext"
import { MenuProvider } from "@/context/MenuContext"
import { CartProvider } from "@/context/CartContext"
import { TableProvider } from "@/context/TableContext"
import { OrderProvider } from "@/context/OrderContext"
import { ReservationProvider } from "@/context/ReservationContext"
import { WaitListProvider } from "@/context/WaitListContext"
import { CustomerProvider } from "@/context/CustomerContext"
import { KitchenProvider } from "@/context/KitchenContext"
import { GiftCardProvider } from "@/context/GiftCardContext"
import { VenueProvider } from "@/context/VenueContext"
// These three were fully implemented and consumed across /dashboard, but never
// mounted, so every consumer threw at runtime. AnalyticsProvider's missing mount
// is what actually broke the production build during prerender.
import { AnalyticsProvider } from "@/context/AnalyticsContext"
import { InventoryProvider } from "@/context/InventoryContext"
import { AttentionProvider } from "@/context/AttentionContext"
import { DragDropProvider } from "@/context/DragDropContext"
import { CashDrawerProvider } from "@/context/CashDrawerContext"
import { ConflictProvider } from "@/components/conflict"
import { AnimationProvider } from "@/components/animation-provider"
import { TourProvider } from "@/components/guided-tour/tour-provider"
import { SWRegistration } from "@/components/sw-registration/SWRegistration"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Maison Chili POS — Restaurant OS",
  description: "Maison Chili POS — orders, tables, kitchen and reports.",
  manifest: "/manifest.json",
    generator: 'v0.dev'
}

import { GlobalShortcutsHandler } from "@/components/layout/global-shortcuts-handler"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#c9682f" />
        <meta name="description" content="Point of sale, kitchen display and guest ordering." />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={inter.className}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
          Skip to content
        </a>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <UiProvider>
          <AnimationProvider>
            <TourProvider>
              <KernelProvider>
                <ConflictProvider>
                <AttentionProvider>
                <AuthProvider>
                <MenuProvider>
                  <CartProvider>
                    <TableProvider>
                      <OrderProvider>
                        <ReservationProvider>
                          <WaitListProvider>
                            <CustomerProvider>
                               <KitchenProvider>
                                 <GiftCardProvider>
                                   <VenueProvider>
                                <AnalyticsProvider>
                                  <InventoryProvider>
                                    <DragDropProvider>
                                      <CashDrawerProvider>
                                      <GlobalShortcutsHandler />
                                      <SWRegistration />
                                      {children}
                                      {/* Sonner is the single toast surface. The Radix
                                          <Toaster/> that used to be mounted here never
                                          rendered a thing: lib/feedback.ts fires sonner
                                          toasts, so every success/error notification in the
                                          app was silently discarded. */}
                                      <SonnerToaster
                                        position="top-center"
                                        richColors
                                        closeButton
                                        duration={4000}
                                        toastOptions={{ className: "font-sans" }}
                                      />
                                      </CashDrawerProvider>
                                    </DragDropProvider>
                                  </InventoryProvider>
                                </AnalyticsProvider>
                                 </VenueProvider>
                                 </GiftCardProvider>
                               </KitchenProvider>
                            </CustomerProvider>
                          </WaitListProvider>
                        </ReservationProvider>
                      </OrderProvider>
                    </TableProvider>
                  </CartProvider>
                </MenuProvider>
                  </AuthProvider>
                </AttentionProvider>
                </ConflictProvider>
                </KernelProvider>
              </TourProvider>
          </AnimationProvider>
          </UiProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
