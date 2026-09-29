"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Copy, Share2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

export function QRCodeGenerator() {
  const [tableNumber, setTableNumber] = useState("")
  const [qrType, setQrType] = useState("menu")
  const [qrSize, setQrSize] = useState("128")
  const [qrColor, setQrColor] = useState("#000000")
  const [qrBgColor, setQrBgColor] = useState("#ffffff")

  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin

  const getQrUrl = () => {
    switch (qrType) {
      case "menu":
        return `${baseUrl}/customer/menu${tableNumber ? `?table=${tableNumber}` : ""}`
      case "order":
        return `${baseUrl}/customer/order${tableNumber ? `?table=${tableNumber}` : ""}`
      case "feedback":
        return `${baseUrl}/customer/feedback${tableNumber ? `?table=${tableNumber}` : ""}`
      default:
        return `${baseUrl}/customer/menu`
    }
  }

  const qrUrl = getQrUrl()

  const handleDownload = () => {
    const svg = document.getElementById("qr-code")
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL("image/png")

      const downloadLink = document.createElement("a")
      downloadLink.download = `qrcode-${qrType}${tableNumber ? `-table-${tableNumber}` : ""}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }

    img.src = "data:image/svg+xml;base64," + btoa(svgData)

    toast({
      title: "QR Code Downloaded",
      description: "The QR code has been downloaded successfully.",
    })
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl)
      toast({
        title: "URL Copied",
        description: "The QR code URL has been copied to clipboard.",
      })
    } catch {
      toast({
        title: "Copy Failed",
        description: "Failed to copy URL to clipboard.",
        variant: "destructive",
      })
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Restaurant ${qrType.charAt(0).toUpperCase() + qrType.slice(1)} QR Code`,
          text: `Scan this QR code to ${qrType === "menu" ? "view our menu" : qrType === "order" ? "place an order" : "leave feedback"}`,
          url: qrUrl,
        })
        toast({
          title: "Shared Successfully",
          description: "The QR code has been shared.",
        })
      } catch {
        toast({
          title: "Share Failed",
          description: "Failed to share QR code.",
          variant: "destructive",
        })
      }
    } else {
      toast({
        title: "Share Not Supported",
        description: "Web Share API is not supported in your browser.",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>QR Code Generator</CardTitle>
        <CardDescription>Generate QR codes for customer-facing features</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="qr-type">QR Code Type</Label>
          <Select value={qrType} onValueChange={setQrType}>
            <SelectTrigger id="qr-type">
              <SelectValue placeholder="Select QR code type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="menu">Digital Menu</SelectItem>
              <SelectItem value="order">Self-Ordering</SelectItem>
              <SelectItem value="feedback">Feedback Form</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-number">Table Number (Optional)</Label>
          <Input
            id="table-number"
            placeholder="Enter table number"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
          />
        </div>

        <Tabs defaultValue="basic">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          <TabsContent value="basic" className="pt-4">
            <div className="flex justify-center">
              <QRCodeSVG
                id="qr-code"
                value={qrUrl}
                size={Number.parseInt(qrSize)}
                fgColor={qrColor}
                bgColor={qrBgColor}
                level="H"
                includeMargin={true}
              />
            </div>
          </TabsContent>
          <TabsContent value="advanced" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="qr-size">QR Code Size</Label>
              <Select value={qrSize} onValueChange={setQrSize}>
                <SelectTrigger id="qr-size">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="128">Small (128px)</SelectItem>
                  <SelectItem value="256">Medium (256px)</SelectItem>
                  <SelectItem value="512">Large (512px)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qr-color">QR Code Color</Label>
              <div className="flex gap-2">
                <Input
                  id="qr-color"
                  type="color"
                  value={qrColor}
                  onChange={(e) => setQrColor(e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <Input type="text" value={qrColor} onChange={(e) => setQrColor(e.target.value)} className="flex-1" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qr-bg-color">Background Color</Label>
              <div className="flex gap-2">
                <Input
                  id="qr-bg-color"
                  type="color"
                  value={qrBgColor}
                  onChange={(e) => setQrBgColor(e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <Input
                  type="text"
                  value={qrBgColor}
                  onChange={(e) => setQrBgColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex justify-center">
              <QRCodeSVG
                id="qr-code-advanced"
                value={qrUrl}
                size={Number.parseInt(qrSize)}
                fgColor={qrColor}
                bgColor={qrBgColor}
                level="H"
                includeMargin={true}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="pt-2">
          <p className="text-sm text-muted-foreground break-all">{qrUrl}</p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy URL
        </Button>
        <Button variant="outline" onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
        <Button onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </CardFooter>
    </Card>
  )
}
