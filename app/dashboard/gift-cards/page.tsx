"use client"

import { useState } from "react"
import { useGiftCard } from "@/context/GiftCardContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Plus, CreditCard, Loader2, Search, DollarSign, X } from "lucide-react"
import { EmptyState } from "@/components/pos/ui-states"
import { format } from "date-fns"
export default function GiftCardsPage() {
  const { giftCards, loading, error, issueGiftCard, loadGiftCard, voidGiftCard, redeemGiftCard } = useGiftCard()
  const [query, setQuery] = useState("")
  const [selectedCard, setSelectedCard] = useState<typeof giftCards[0] | null>(null)

  // Stats
  const activeCards = giftCards.filter((c) => c.status === "active")
  const totalBalance = activeCards.reduce((sum, c) => sum + c.balance, 0)
  const totalIssued = activeCards.reduce((sum, c) => sum + c.initialBalance, 0)
  const totalRedeemed = totalIssued - totalBalance

  const filteredCards = giftCards.filter((card) =>
    card.cardNumber.toLowerCase().includes(query.toLowerCase()) ||
    card.recipientEmail?.toLowerCase().includes(query.toLowerCase()) ||
    card.purchaserCustomerId?.includes(query)
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gift Cards</h1>
        <Button onClick={() => setSelectedCard(null)} className="gap-2">
          <Plus className="h-4 w-4" />
          Issue New Card
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cards</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{activeCards.length}</div>
            <p className="text-xs text-muted-foreground">Total issued: {giftCards.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">${totalBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Liability on balance sheet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redeemed This Period</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">${totalRedeemed.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Issued: ${totalIssued.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by card number, email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Gift Cards Table */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All ({giftCards.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeCards.length})</TabsTrigger>
          <TabsTrigger value="voided">Voided ({giftCards.filter((c) => c.status === "voided").length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <GiftCardTable cards={filteredCards} onSelect={setSelectedCard} isFirstRun={giftCards.length === 0} />
        </TabsContent>

        <TabsContent value="active" className="mt-4">
          <GiftCardTable cards={activeCards.filter((c) => filteredCards.includes(c))} onSelect={setSelectedCard} isFirstRun={giftCards.length === 0} />
        </TabsContent>

        <TabsContent value="voided" className="mt-4">
          <GiftCardTable cards={giftCards.filter((c) => c.status === "voided" && filteredCards.includes(c))} onSelect={setSelectedCard} isFirstRun={giftCards.length === 0} />
        </TabsContent>
      </Tabs>

      {loading && <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50"><Loader2 className="h-8 w-8 animate-spin" /></div>}
      {error && <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg">{error}</div>}

      {/* Issue New Card Dialog */}
      <IssueCardDialog onClose={() => setSelectedCard(null)} onSubmit={issueGiftCard} loading={loading} />

      {/* Card Detail Dialog */}
      {selectedCard && (
        <CardDetailDialog
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onLoad={loadGiftCard}
          onRedeem={redeemGiftCard}
          onVoid={voidGiftCard}
          loading={loading}
        />
      )}
    </div>
  )
}

function GiftCardTable({ cards, onSelect, isFirstRun }: { cards: import("@/context/GiftCardContext").GiftCardRow[]; onSelect: (card: import("@/context/GiftCardContext").GiftCardRow | null) => void; isFirstRun?: boolean }) {
  if (cards.length === 0) {
    return (
      <EmptyState
        title={isFirstRun ? "No gift cards issued yet" : "No gift cards match this filter"}
        hint={
          isFirstRun
            ? "Issue your first card — stored value brings guests back."
            : "Try a different search or tab."
        }
      />
    )
  }

  const onClickHandler = (card: import("@/context/GiftCardContext").GiftCardRow) => {
    onSelect(card)
  }

  const onSelectHandler = (card: import("@/context/GiftCardContext").GiftCardRow) => {
    onSelect(card)
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-sm">
                <th className="p-3">Card Number</th>
                <th className="p-3 text-right">Balance</th>
                <th className="p-3 text-right">Initial</th>
                <th className="p-3">Status</th>
                <th className="p-3">Recipient</th>
                <th className="p-3">Last Activity</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.cardId} className="border-b hover:bg-accent/50 cursor-pointer" onClick={() => onClickHandler(card)}>
                  <td className="p-3 font-mono text-sm">{card.cardNumber}</td>
                  <td className="p-3 text-right font-medium tabular-nums">${card.balance.toFixed(2)}</td>
                  <td className="p-3 text-right text-muted-foreground text-sm">${card.initialBalance.toFixed(2)}</td>
                  <td className="p-3">
                    <Badge variant={card.status === "active" ? "default" : "destructive"} className="gap-1">
                      {card.status === "active" && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                      {card.status === "voided" && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                      {card.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm truncate max-w-[150px]">{card.recipientEmail || "—"}</td>
                  <td className="p-3 text-sm text-muted-foreground">{card.updatedAt ? format(new Date(card.updatedAt), "MMM d, yyyy") : "—"}</td>
                  <td className="p-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onSelectHandler(card) }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function IssueCardDialog({ onClose, onSubmit, loading }: { onClose: () => void; onSubmit: (data: { cardNumber: string; initialBalance: number; currency: string; purchaserCustomerId?: string; recipientEmail?: string }) => Promise<void>; loading: boolean }) {
  const [cardNumber, setCardNumber] = useState("")
  const [initialBalance, setInitialBalance] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [purchaserCustomerId, setPurchaserCustomerId] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [localError, setLocalError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError("")
    if (!cardNumber.trim() || !initialBalance) {
      setLocalError("Card number and initial balance are required")
      return
    }
    try {
      await onSubmit({
        cardNumber: cardNumber.trim().toUpperCase(),
        initialBalance: parseFloat(initialBalance),
        currency,
        purchaserCustomerId: purchaserCustomerId || undefined,
        recipientEmail: recipientEmail || undefined,
      })
      onClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to issue card")
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Issue New Gift Card</DialogTitle>
          <DialogDescription>Create a new gift card with an initial balance</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input id="cardNumber" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="GC-12345" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="initialBalance">Initial Balance</Label>
            <Input id="initialBalance" type="number" step="0.01" min="0.01" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} placeholder="50.00" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchaserCustomerId">Purchaser Customer ID (optional)</Label>
            <Input id="purchaserCustomerId" value={purchaserCustomerId} onChange={(e) => setPurchaserCustomerId(e.target.value)} placeholder="CUST-123" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipientEmail">Recipient Email (optional)</Label>
            <Input id="recipientEmail" type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="recipient@example.com" />
          </div>
          {localError && <p className="text-sm text-destructive">{localError}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Issue Card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CardDetailDialog({ card, onClose, onLoad, onRedeem, onVoid, loading }: { card: import("@/context/GiftCardContext").GiftCardRow; onClose: () => void; onLoad: (cardId: string, amount: number) => Promise<void>; onRedeem: (cardId: string, orderId: string, amount: number) => Promise<void>; onVoid: (cardId: string, reason?: string) => Promise<void>; loading: boolean }) {
  const [loadAmount, setLoadAmount] = useState("")
  const [redeemAmount, setRedeemAmount] = useState("")
  const [redeemOrderId, setRedeemOrderId] = useState("")
  const [voidReason, setVoidReason] = useState("")

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Gift Card: {card.cardNumber}</span>
            <Badge variant={card.status === "active" ? "default" : "destructive"}>
              {card.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Balance: <span className="font-bold">${card.balance.toFixed(2)}</span> / ${card.initialBalance.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><Label>Card Number</Label><p className="font-mono">{card.cardNumber}</p></div>
            <div><Label>Status</Label><Badge variant={card.status === "active" ? "default" : "destructive"}>{card.status}</Badge></div>
            <div><Label>Initial Balance</Label><p>${card.initialBalance.toFixed(2)}</p></div>
            <div><Label>Currency</Label><p>{card.currency}</p></div>
            <div><Label>Recipient</Label><p>{card.recipientEmail || "—"}</p></div>
            <div><Label>Purchaser</Label><p>{card.purchaserCustomerId || "—"}</p></div>
            <div><Label>Issued</Label><p>{card.issuedAt ? format(new Date(card.issuedAt), "MMM d, yyyy") : "—"}</p></div>
            <div><Label>Last Activity</Label><p>{card.updatedAt ? format(new Date(card.updatedAt), "MMM d, yyyy") : "—"}</p></div>
            <div><Label>Transactions</Label><p>{card.txCount}</p></div>
          </div>

          {card.status === "active" && (
            <>
              <div className="space-y-2">
                <Label>Load Balance</Label>
                <div className="flex gap-2">
                  <Input type="number" step="0.01" min="0.01" placeholder="Amount" value={loadAmount} onChange={(e) => setLoadAmount(e.target.value)} className="w-32" />
                  <Button onClick={() => { onLoad(card.cardId, parseFloat(loadAmount)); setLoadAmount("") }} disabled={loading || !loadAmount}>Load</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Redeem (Apply to Order)</Label>
                <div className="flex gap-2 flex-wrap">
                  <Input type="number" step="0.01" min="0.01" placeholder="Amount" value={redeemAmount} onChange={(e) => setRedeemAmount(e.target.value)} className="w-32" />
                  <Input placeholder="Order ID" value={redeemOrderId} onChange={(e) => setRedeemOrderId(e.target.value)} className="w-48" />
                  <Button onClick={() => { onRedeem(card.cardId, redeemOrderId, parseFloat(redeemAmount)); setRedeemAmount(""); setRedeemOrderId("") }} disabled={loading || !redeemAmount || !redeemOrderId}>Redeem</Button>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t">
                <Label>Void Card</Label>
                <div className="flex gap-2">
                  <Input placeholder="Reason (optional)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} className="flex-1" />
                  <Button variant="destructive" onClick={() => { onVoid(card.cardId, voidReason || "Voided from dashboard"); onClose() }} disabled={loading}>Void Card</Button>
                </div>
              </div>
            </>
          )}

          {card.status === "voided" && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">This card has been voided. {card.voidReason ? `Reason: ${card.voidReason}` : ""}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}