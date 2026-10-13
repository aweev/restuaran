"use client"

import { useEffect, useRef, useState } from "react"
import { useMenu } from "@/context/MenuContext"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MenuItemCard } from "@/components/menu/menu-item-card"
import { Loader2, Plus, Search, Upload } from "lucide-react"
import { markMenuStarterDone, parseMenuCsv } from "@/lib/settings"
import type { MenuCategory } from "@/types"

export default function MenuPage() {
  const { state, fetchMenu, setSelectedCategory, addItem } = useMenu()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [importing, setImporting] = useState(false)
  const [importReport, setImportReport] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchMenu()
      } catch (error) {
        console.error("Error loading menu data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fetchMenu])

  const handleCategoryChange = (category: MenuCategory) => {
    setSelectedCategory(category)
  }

  // Day-one import: paste or upload `name, price` lines (paper menu → POS in
  // minutes). Invalid lines are skipped and reported, never half-imported
  // silently.
  const importCsvText = async (text: string) => {
    const rows = parseMenuCsv(text)
    if (rows.length === 0) {
      setImportReport("No valid `name, price` lines found.")
      return
    }
    setImporting(true)
    let ok = 0
    let failed = 0
    for (const [i, row] of rows.entries()) {
      try {
        await addItem({
          id: `import-${Date.now()}-${i}`,
          title: row.name,
          price: row.price,
          category: "main",
        } as Parameters<typeof addItem>[0])
        ok += 1
      } catch {
        failed += 1
      }
    }
    setImporting(false)
    markMenuStarterDone()
    setImportReport(`Imported ${ok} items${failed > 0 ? `, ${failed} failed` : ""}.`)
  }

  const filteredItems = state.items.filter((item) => {
    // Filter by category
    if (state.selectedCategory !== "all" && item.category.toLowerCase() !== state.selectedCategory) {
      return false
    }

    // Filter by search query
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }

    return true
  })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Menu Management</h2>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            aria-label="Import menu CSV"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              void f.text().then((t) => importCsvText(t))
              e.target.value = ""
            }}
          />
          <Button variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> {importing ? "Importing…" : "Import CSV"}
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>
      {importReport && (
        <p className="text-sm text-muted-foreground" role="status">{importReport} Format: one <code>name, price</code> per line.</p>
      )}

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search menu items..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" onValueChange={(value) => handleCategoryChange(value as MenuCategory)}>
        <TabsList className="mb-4 flex flex-wrap">
          {state.categories.map((category) => (
            <TabsTrigger key={category.id} value={category.id}>
              {category.label} ({category.items})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={state.selectedCategory} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => <MenuItemCard key={item.id} menuItem={item} />)
            ) : (
              <Card className="col-span-full">
                <CardContent className="flex h-40 items-center justify-center">
                  <p className="text-muted-foreground">No menu items found</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
