import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/context/AuthContext"
import { MenuProvider } from "@/context/MenuContext"
import { CartProvider } from "@/context/CartContext"
import { TableProvider } from "@/context/TableContext"
import { OrderProvider } from "@/context/OrderContext"
import { ReservationProvider } from "@/context/ReservationContext"
import { WaitListProvider } from "@/context/WaitListContext"
import { CustomerProvider } from "@/context/CustomerContext"
import { KitchenProvider } from "@/context/KitchenContext"
import { AnimationProvider } from "@/components/animation-provider"
import { TourProvider } from "@/components/guided-tour/tour-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Restaurant POS",
  description: "A comprehensive restaurant point of sale system",
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
        <meta name="theme-color" content="#10b981" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AnimationProvider>
            <TourProvider>
              <AuthProvider>
                <MenuProvider>
                  <CartProvider>
                    <TableProvider>
                      <OrderProvider>
                        <ReservationProvider>
                          <WaitListProvider>
                            <CustomerProvider>
                              <KitchenProvider>
                                <GlobalShortcutsHandler />
                                {children}
                                <Toaster />
                              </KitchenProvider>
                            </CustomerProvider>
                          </WaitListProvider>
                        </ReservationProvider>
                      </OrderProvider>
                    </TableProvider>
                  </CartProvider>
                </MenuProvider>
              </AuthProvider>
            </TourProvider>
          </AnimationProvider>
        </ThemeProvider>
        
        {/* Register service worker for offline support */}

        {/* Let&apos;s create a responsive utility component: */}
        {/* <script>
          if ("serviceWorker" in navigator) {
            window.addEventListener("load", () => {
              navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                  console.log("Service Worker registered with scope:", registration.scope);
                })
                .catch((error) => {
                  console.error("Service Worker registration failed:", error);
                });
            });
          }
        </script> */}
      </body>
    </html>
  )
}
