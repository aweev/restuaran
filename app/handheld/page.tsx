"use client"

import { useMemo, useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { useCommand, useKernel, useProjection } from "@/kernel/react/kernel-provider"
import { useFeedback } from "@/lib/feedback"
import { KernelStatusIndicator } from "@/components/layout/KernelStatusIndicator"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Copy, Loader2, Zap, ScanBarcode, X } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface MenuBoard { items?: Array<{ id: string; name: string; price: number; available?: boolean; eightySixed?: boolean }> }

/**
 * Handheld server mode: thumb-first, large targets, QR table login.
 * Writes go through the kernel offline queue, so roaming servers survive dead zones.
 */
export default function HandheldPage() {
  const { run, pending } = useCommand()
  const { pendingCount } = useKernel()
  const { notify } = useFeedback()
  const { state: menu } = useProjection<MenuBoard>("menu.board", 5000)
  const [tableId, setTableId] = useState("")
  const [orderId, setOrderId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [cartItems, setCartItems] = useState<Array<{ id: string; name: string; unitPrice: number; quantity: number }>>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanIntervalRef = useRef<number | null>(null)
  const lastScannedRef = useRef<string>("")
  const stopScanningRef = useRef<(() => void) | null>(null)
  const scanningRef = useRef(scanning)
  scanningRef.current = scanning

  // Define stopScanning first so it can be referenced
  const stopScanning = useCallback(() => {
    setScanning(false)
    if (scanIntervalRef.current) {
      cancelAnimationFrame(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  stopScanningRef.current = stopScanning

  useEffect(() => () => stopScanning(), [stopScanning])

  const items = useMemo(() => {
    const all = menu?.items ?? []
    const q = query.trim().toLowerCase()
    return all.filter((i) => (i.available ?? true) && !i.eightySixed && (!q || i.name.toLowerCase().includes(q))).slice(0, 60)
  }, [menu, query])

  // Parse tableId from URL ?table= query param on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const table = params.get("table")
    if (table) setTableId(table)
  }, [])

  // Camera scanning using BarcodeDetector API (Chrome/Edge) or html5-qrcode fallback
  const startScanning = useCallback(async () => {
    if (typeof window === "undefined") return
    setScanning(true)
    setScanError(null)
    lastScannedRef.current = ""

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // Use native BarcodeDetector if available
      if ("BarcodeDetector" in window) {
        const detector = new (window as unknown as { BarcodeDetector: new () => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector()
        const scanLoop = async () => {
          if (!scanningRef.current || !videoRef.current) return
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) {
              const value = barcodes[0].rawValue
              if (value !== lastScannedRef.current) {
                lastScannedRef.current = value
                // Expect QR to contain tableId or ?table=TABLE_ID
                const tableMatch = value.match(/table[=:](\w+)/i) || value.match(/^(\w+)$/)
                if (tableMatch) {
                  setTableId(tableMatch[1])
                  stopScanningRef.current?.()
                  notify("success", `Table ${tableMatch[1]} loaded`)
                }
              }
            }
          } catch {
            // detection failed, continue
          }
          if (scanningRef.current) scanIntervalRef.current = window.requestAnimationFrame(scanLoop)
        }
        scanLoop()
      } else {
        // Fallback: poll with html5-qrcode-like logic (simplified)
        // For now, just show manual entry hint
        setScanError("Camera scanning not supported in this browser. Enter table manually.")
      }
    } catch {
      setScanError("Camera access denied. Enter table manually.")
      setScanning(false)
    }
  }, [notify])

  const ensureDraft = async (): Promise<string> => {
    if (orderId) return orderId
    if (!tableId.trim()) throw new Error("Enter a table first (or scan its QR).")
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `o-${Date.now()}`
    const res = await run("order.create", { orderId: id, tableId: tableId.trim(), channel: "handheld" })
    if (!res.success) throw new Error(res.error?.message ?? "Could not open order")
    setOrderId(id)
    return id
  }

  const add = async (menuItemId: string, name: string, unitPrice: number) => {
    try {
      const id = await ensureDraft()
      const res = await run("order.addLine", { orderId: id, menuItemId, name, unitPrice, quantity: 1 })
      if (!res.success) notify("error", "Couldn't add item", res.error?.message)
      else {
        notify("success", `Added ${name}`)
        // Update local cart for review
        setCartItems((prev) => {
          const existing = prev.find((item) => item.name === name && item.unitPrice === unitPrice)
          if (existing) {
            return prev.map((item) =>
              item.name === name && item.unitPrice === unitPrice ? { ...item, quantity: item.quantity + 1 } : item
            )
          }
          return [...prev, { id: menuItemId, name, unitPrice, quantity: 1 }]
        })
      }
    } catch (e) {
      notify("error", "Couldn't add item", e instanceof Error ? e.message : undefined)
    }
  }

  const send = async () => {
    if (!orderId) return
    const res = await run("order.sendToKitchen", { orderId })
    if (!res.success) notify("error", "Couldn't fire order", res.error?.message)
    else {
      notify("success", "Fired to kitchen")
      setOrderId(null)
      setCartItems([])
    }
  }

  const clearOrder = () => {
    if (!orderId) return
    // Queue a void command for the draft
    run("order.void", { orderId, reason: "cleared on handheld" }).catch(() => undefined)
    setOrderId(null)
    setCartItems([])
    setConfirmClear(false)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 p-4 pb-24">
      <header className="sticky top-0 flex items-center justify-between bg-background py-2">
        <h1 className="text-xl font-bold">Handheld</h1>
        <div className="flex items-center gap-2">
          <KernelStatusIndicator />
          {pendingCount > 0 && (
            <span aria-label={`${pendingCount} queued`} className="rounded bg-amber-100 px-2 py-1 text-sm flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {pendingCount}
            </span>
          )}
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">Table</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="hh-table">Table / QR code</Label>
              <Input
                id="hh-table"
                inputMode="text"
                autoComplete="off"
                placeholder="T4 or scan ?table=T4"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="h-12 text-lg"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={scanning ? "default" : "outline"}
              onClick={scanning ? stopScanning : startScanning}
              className="h-12 flex-1 text-base"
              disabled={pending}
            >
              {scanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning… Tap to stop
                </>
              ) : (
                <>
                  <ScanBarcode className="mr-2 h-4 w-4" />
                  Scan QR
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const href = `${window.location.origin}/handheld?table=${encodeURIComponent(tableId)}`
                navigator.clipboard.writeText(href).then(
                  () => notify("success", "Link copied"),
                  () => notify("error", "Couldn't copy link"),
                )
              }}
              className="h-12"
              disabled={!tableId}
              aria-label="Copy handheld order link"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </Button>
          </div>

          {scanError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded p-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{scanError}</span>
            </div>
          )}

          {scanning && (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
              <video
                ref={videoRef}
                playsInline
                className="w-full h-full object-cover"
                aria-hidden="true"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/50 rounded-lg" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <Label htmlFor="hh-search">Search menu</Label>
        <Input id="hh-search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-12 text-lg" />
      </div>

      <div className="grid grid-cols-1 gap-2" role="list">
        {items.map((i) => (
          <button
            key={i.id}
            role="listitem"
            onClick={() => void add(i.id, i.name, Number(i.price))}
            disabled={pending || !tableId.trim()}
            className="flex min-h-[56px] items-center justify-between rounded-lg border px-4 py-3 text-left text-lg active:bg-accent disabled:opacity-50"
          >
            <span>{i.name}</span>
            <span className="font-semibold">${Number(i.price).toFixed(2)}</span>
          </button>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No sellable items — check the menu board.</p>}
      </div>

      {cartItems.length > 0 && orderId && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Order Review
              <span className="text-sm font-normal text-muted-foreground">
                {cartItems.reduce((sum, i) => sum + i.quantity, 0)} items · ${cartItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0).toFixed(2)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-48 overflow-y-auto">
            {cartItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 py-1 border-b">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">${item.unitPrice.toFixed(2)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      // Remove one quantity
                      run("order.addLine", { orderId, menuItemId: item.id, name: item.name, unitPrice: item.unitPrice, quantity: -1 }).catch(() => {})
                      setCartItems((prev) =>
                        item.quantity <= 1
                          ? prev.filter((i) => i.id !== item.id)
                          : prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i))
                      )
                    }}
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      run("order.addLine", { orderId, menuItemId: item.id, name: item.name, unitPrice: item.unitPrice, quantity: 1 }).catch(() => {})
                      setCartItems((prev) =>
                        prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))
                      )
                    }}
                    aria-label={`Add another ${item.name}`}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-semibold w-16 text-right">${(item.unitPrice * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-end text-lg font-bold pt-2">
              Total: ${cartItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      )}

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-lg items-center gap-2 border-t bg-background p-3">
        <Button variant="outline" asChild className="h-12 flex-1 text-base">
          <Link href="/dashboard/tables">Tables</Link>
        </Button>
        {orderId ? (
          <div className="flex gap-2 flex-1">
            <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="h-12 flex-1 text-base" disabled={pending}>
                  <X className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear this order?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This voids every item on the draft and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep order</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearOrder}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Clear order
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={() => void send()} disabled={pending} className="h-12 flex-1 text-base bg-green-600 hover:bg-green-700">
              <CheckCircle className="mr-2 h-4 w-4" />
              Fire to Kitchen
            </Button>
          </div>
        ) : (
          <Button disabled={!tableId.trim() || pending} className="h-12 w-full text-base">
            Pick a table first
          </Button>
        )}
      </nav>
    </main>
  )
}
