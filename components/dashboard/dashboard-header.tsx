"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ModeToggle } from "@/components/mode-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Search, LogOut, Settings, User, Clock } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { CommandPalette } from "@/components/pos/command-palette";
import { OfflineQueuePanel } from "@/components/pos/offline-queue-panel";
import { useKernel } from "@/kernel/react/kernel-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { personaFor } from "@/lib/personas";
import { KernelStatusIndicator } from "@/components/layout/KernelStatusIndicator";

export function openPalette() {
  document.dispatchEvent(new Event("pos:open-palette"));
}

export function DashboardHeader() {
  const { state: authState, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const persona = personaFor(authState.user?.role);

  const crumbs = (pathname ?? "/dashboard").split("/").filter(Boolean).slice(1);

  const { pendingCount, connection } = useKernel();

  const handleLogout = () => { logout(); router.push("/login"); };
  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-16 items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <MobileNav />
          <div className="hidden min-w-0 md:block">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink href="/dashboard">POS</BreadcrumbLink></BreadcrumbItem>
                {crumbs.length === 0 && (<><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Dashboard</BreadcrumbPage></BreadcrumbItem></>)}
                {crumbs.map((c, i) => (
                  <span key={c + i} className="flex items-center gap-1.5">
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {i === crumbs.length - 1
                        ? <BreadcrumbPage className="capitalize">{c.replace("-", " ")}</BreadcrumbPage>
                        : <BreadcrumbLink className="capitalize" href={`/dashboard/${crumbs.slice(0, i + 1).join("/")}`}>{c.replace("-", " ")}</BreadcrumbLink>}
                    </BreadcrumbItem>
                  </span>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <h1 className="truncate text-lg font-semibold md:hidden">Maison Chili POS</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Button variant="outline" size="sm" className="hidden gap-2 text-muted-foreground sm:flex" onClick={openPalette} aria-label="Search actions (Ctrl+K)">
            <Search className="h-3.5 w-3.5" /> Search… <kbd className="rounded border px-1 text-[10px]">Ctrl K</kbd>
          </Button>
          <KernelStatusIndicator />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" aria-label={`Offline queue, ${pendingCount} pending`}>
                Queue{pendingCount > 0 ? ` (${pendingCount})` : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end">
              <OfflineQueuePanel />
            </PopoverContent>
          </Popover>
          {connection === "offline" && <Badge variant="destructive">Offline</Badge>}
          {authState.user && (
            <Badge variant="secondary" className="hidden capitalize lg:inline-flex" title={persona.tagline}>
              {persona.title}
            </Badge>
          )}
          {authState.currentShift && (
            <Badge variant="outline" className="hidden gap-1 border-emerald-300 text-emerald-700 md:inline-flex">
              <Clock className="h-3 w-3" /> On shift
            </Badge>
          )}
          <NotificationCenter />
          <ModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full" aria-label="Account menu">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={authState.user?.avatar || "/placeholder.svg"} alt={authState.user?.name || "User"} />
                  <AvatarFallback>{authState.user?.name ? getInitials(authState.user.name) : "U"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{authState.user?.name ?? "Guest"}</p>
                  <p className="text-xs leading-none text-muted-foreground">{authState.user?.email ?? "Not signed in"}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")}><User className="mr-2 h-4 w-4" /><span>Profile</span></DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}><Settings className="mr-2 h-4 w-4" /><span>Settings</span></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /><span>Log out</span></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CommandPalette />
    </header>
  );
}
