"use client"

import type { ReactNode } from "react"
import { AuthProvider } from "./AuthContext"
import { MenuProvider } from "./MenuContext"
import { CartProvider } from "./CartContext"
import { TableProvider } from "./TableContext"
import { OrderProvider } from "./OrderContext"
import { KitchenProvider } from "./KitchenContext"

interface AppProviderProps {
  children: ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
  return (
    <AuthProvider>
      <MenuProvider>
        <TableProvider>
          <CartProvider>
            <OrderProvider>
              <KitchenProvider>{children}</KitchenProvider>
            </OrderProvider>
          </CartProvider>
        </TableProvider>
      </MenuProvider>
    </AuthProvider>
  )
}
