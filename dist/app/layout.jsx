"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
const google_1 = require("next/font/google");
require("./globals.css");
const theme_provider_1 = require("@/components/theme-provider");
const toaster_1 = require("@/components/ui/toaster");
const AuthContext_1 = require("@/context/AuthContext");
const MenuContext_1 = require("@/context/MenuContext");
const CartContext_1 = require("@/context/CartContext");
const TableContext_1 = require("@/context/TableContext");
const OrderContext_1 = require("@/context/OrderContext");
const ReservationContext_1 = require("@/context/ReservationContext");
const WaitListContext_1 = require("@/context/WaitListContext");
const CustomerContext_1 = require("@/context/CustomerContext");
const KitchenContext_1 = require("@/context/KitchenContext");
const animation_provider_1 = require("@/components/animation-provider");
const tour_provider_1 = require("@/components/guided-tour/tour-provider");
const inter = (0, google_1.Inter)({ subsets: ["latin"] });
exports.metadata = {
    title: "Restaurant POS",
    description: "A comprehensive restaurant point of sale system",
    manifest: "/manifest.json",
    generator: 'v0.dev'
};
const global_shortcuts_handler_1 = require("@/components/layout/global-shortcuts-handler");
function RootLayout({ children, }) {
    return (<html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#10b981"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="default"/>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png"/>
      </head>
      <body className={inter.className}>
        <theme_provider_1.ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <animation_provider_1.AnimationProvider>
            <tour_provider_1.TourProvider>
              <AuthContext_1.AuthProvider>
                <MenuContext_1.MenuProvider>
                  <CartContext_1.CartProvider>
                    <TableContext_1.TableProvider>
                      <OrderContext_1.OrderProvider>
                        <ReservationContext_1.ReservationProvider>
                          <WaitListContext_1.WaitListProvider>
                            <CustomerContext_1.CustomerProvider>
                              <KitchenContext_1.KitchenProvider>
                                <global_shortcuts_handler_1.GlobalShortcutsHandler />
                                {children}
                                <toaster_1.Toaster />
                              </KitchenContext_1.KitchenProvider>
                            </CustomerContext_1.CustomerProvider>
                          </WaitListContext_1.WaitListProvider>
                        </ReservationContext_1.ReservationProvider>
                      </OrderContext_1.OrderProvider>
                    </TableContext_1.TableProvider>
                  </CartContext_1.CartProvider>
                </MenuContext_1.MenuProvider>
              </AuthContext_1.AuthProvider>
            </tour_provider_1.TourProvider>
          </animation_provider_1.AnimationProvider>
        </theme_provider_1.ThemeProvider>
        
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
    </html>);
}
