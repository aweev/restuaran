"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppProvider = AppProvider;
const AuthContext_1 = require("./AuthContext");
const MenuContext_1 = require("./MenuContext");
const CartContext_1 = require("./CartContext");
const TableContext_1 = require("./TableContext");
const OrderContext_1 = require("./OrderContext");
const KitchenContext_1 = require("./KitchenContext");
function AppProvider({ children }) {
    return (<AuthContext_1.AuthProvider>
      <MenuContext_1.MenuProvider>
        <TableContext_1.TableProvider>
          <CartContext_1.CartProvider>
            <OrderContext_1.OrderProvider>
              <KitchenContext_1.KitchenProvider>{children}</KitchenContext_1.KitchenProvider>
            </OrderContext_1.OrderProvider>
          </CartContext_1.CartProvider>
        </TableContext_1.TableProvider>
      </MenuContext_1.MenuProvider>
    </AuthContext_1.AuthProvider>);
}
