"use client";

import type React from "react";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { NeedsAttentionDrawer } from "@/components/pos/needs-attention-drawer";
import { ShortcutsDialog } from "@/components/pos/shortcuts-dialog";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  // Route-change focus: move focus to the main region on navigation so
  // screen-reader users land on the new content (prefers-reduced-motion safe:
  // no scrolling animation, just focus).
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: false });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />
      <div className="flex justify-end px-4 pt-3 md:px-6">
        <NeedsAttentionDrawer />
      </div>
      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 border-r bg-background md:block" aria-label="Sidebar">
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto pos-scroll-thin">
            <DashboardNav />
          </div>
        </aside>
        <main ref={mainRef} tabIndex={-1} aria-label="Main content" className="min-w-0 flex-1 overflow-auto p-4 outline-none md:p-6">
          <div className="mx-auto w-full max-w-6xl pos-fade-in">{children}</div>
        </main>
      </div>
      <ShortcutsDialog />
    </div>
  );
}
