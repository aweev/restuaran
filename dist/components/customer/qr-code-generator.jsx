"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QRCodeGenerator = QRCodeGenerator;
const react_1 = require("react");
const qrcode_react_1 = require("qrcode.react");
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const select_1 = require("@/components/ui/select");
const tabs_1 = require("@/components/ui/tabs");
const lucide_react_1 = require("lucide-react");
const use_toast_1 = require("@/components/ui/use-toast");
function QRCodeGenerator() {
    const [tableNumber, setTableNumber] = (0, react_1.useState)("");
    const [qrType, setQrType] = (0, react_1.useState)("menu");
    const [qrSize, setQrSize] = (0, react_1.useState)("128");
    const [qrColor, setQrColor] = (0, react_1.useState)("#000000");
    const [qrBgColor, setQrBgColor] = (0, react_1.useState)("#ffffff");
    const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin;
    const getQrUrl = () => {
        switch (qrType) {
            case "menu":
                return `${baseUrl}/customer/menu${tableNumber ? `?table=${tableNumber}` : ""}`;
            case "order":
                return `${baseUrl}/customer/order${tableNumber ? `?table=${tableNumber}` : ""}`;
            case "feedback":
                return `${baseUrl}/customer/feedback${tableNumber ? `?table=${tableNumber}` : ""}`;
            default:
                return `${baseUrl}/customer/menu`;
        }
    };
    const qrUrl = getQrUrl();
    const handleDownload = () => {
        const svg = document.getElementById("qr-code");
        if (!svg)
            return;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx === null || ctx === void 0 ? void 0 : ctx.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.download = `qrcode-${qrType}${tableNumber ? `-table-${tableNumber}` : ""}.png`;
            downloadLink.href = pngFile;
            downloadLink.click();
        };
        img.src = "data:image/svg+xml;base64," + btoa(svgData);
        (0, use_toast_1.toast)({
            title: "QR Code Downloaded",
            description: "The QR code has been downloaded successfully.",
        });
    };
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(qrUrl);
            (0, use_toast_1.toast)({
                title: "URL Copied",
                description: "The QR code URL has been copied to clipboard.",
            });
        }
        catch (_a) {
            (0, use_toast_1.toast)({
                title: "Copy Failed",
                description: "Failed to copy URL to clipboard.",
                variant: "destructive",
            });
        }
    };
    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Restaurant ${qrType.charAt(0).toUpperCase() + qrType.slice(1)} QR Code`,
                    text: `Scan this QR code to ${qrType === "menu" ? "view our menu" : qrType === "order" ? "place an order" : "leave feedback"}`,
                    url: qrUrl,
                });
                (0, use_toast_1.toast)({
                    title: "Shared Successfully",
                    description: "The QR code has been shared.",
                });
            }
            catch (_a) {
                (0, use_toast_1.toast)({
                    title: "Share Failed",
                    description: "Failed to share QR code.",
                    variant: "destructive",
                });
            }
        }
        else {
            (0, use_toast_1.toast)({
                title: "Share Not Supported",
                description: "Web Share API is not supported in your browser.",
                variant: "destructive",
            });
        }
    };
    return (<card_1.Card className="w-full max-w-md mx-auto">
      <card_1.CardHeader>
        <card_1.CardTitle>QR Code Generator</card_1.CardTitle>
        <card_1.CardDescription>Generate QR codes for customer-facing features</card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent className="space-y-4">
        <div className="space-y-2">
          <label_1.Label htmlFor="qr-type">QR Code Type</label_1.Label>
          <select_1.Select value={qrType} onValueChange={setQrType}>
            <select_1.SelectTrigger id="qr-type">
              <select_1.SelectValue placeholder="Select QR code type"/>
            </select_1.SelectTrigger>
            <select_1.SelectContent>
              <select_1.SelectItem value="menu">Digital Menu</select_1.SelectItem>
              <select_1.SelectItem value="order">Self-Ordering</select_1.SelectItem>
              <select_1.SelectItem value="feedback">Feedback Form</select_1.SelectItem>
            </select_1.SelectContent>
          </select_1.Select>
        </div>

        <div className="space-y-2">
          <label_1.Label htmlFor="table-number">Table Number (Optional)</label_1.Label>
          <input_1.Input id="table-number" placeholder="Enter table number" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)}/>
        </div>

        <tabs_1.Tabs defaultValue="basic">
          <tabs_1.TabsList className="grid w-full grid-cols-2">
            <tabs_1.TabsTrigger value="basic">Basic</tabs_1.TabsTrigger>
            <tabs_1.TabsTrigger value="advanced">Advanced</tabs_1.TabsTrigger>
          </tabs_1.TabsList>
          <tabs_1.TabsContent value="basic" className="pt-4">
            <div className="flex justify-center">
              <qrcode_react_1.QRCodeSVG id="qr-code" value={qrUrl} size={Number.parseInt(qrSize)} fgColor={qrColor} bgColor={qrBgColor} level="H" includeMargin={true}/>
            </div>
          </tabs_1.TabsContent>
          <tabs_1.TabsContent value="advanced" className="space-y-4 pt-4">
            <div className="space-y-2">
              <label_1.Label htmlFor="qr-size">QR Code Size</label_1.Label>
              <select_1.Select value={qrSize} onValueChange={setQrSize}>
                <select_1.SelectTrigger id="qr-size">
                  <select_1.SelectValue placeholder="Select size"/>
                </select_1.SelectTrigger>
                <select_1.SelectContent>
                  <select_1.SelectItem value="128">Small (128px)</select_1.SelectItem>
                  <select_1.SelectItem value="256">Medium (256px)</select_1.SelectItem>
                  <select_1.SelectItem value="512">Large (512px)</select_1.SelectItem>
                </select_1.SelectContent>
              </select_1.Select>
            </div>

            <div className="space-y-2">
              <label_1.Label htmlFor="qr-color">QR Code Color</label_1.Label>
              <div className="flex gap-2">
                <input_1.Input id="qr-color" type="color" value={qrColor} onChange={(e) => setQrColor(e.target.value)} className="w-12 h-10 p-1"/>
                <input_1.Input type="text" value={qrColor} onChange={(e) => setQrColor(e.target.value)} className="flex-1"/>
              </div>
            </div>

            <div className="space-y-2">
              <label_1.Label htmlFor="qr-bg-color">Background Color</label_1.Label>
              <div className="flex gap-2">
                <input_1.Input id="qr-bg-color" type="color" value={qrBgColor} onChange={(e) => setQrBgColor(e.target.value)} className="w-12 h-10 p-1"/>
                <input_1.Input type="text" value={qrBgColor} onChange={(e) => setQrBgColor(e.target.value)} className="flex-1"/>
              </div>
            </div>

            <div className="flex justify-center">
              <qrcode_react_1.QRCodeSVG id="qr-code-advanced" value={qrUrl} size={Number.parseInt(qrSize)} fgColor={qrColor} bgColor={qrBgColor} level="H" includeMargin={true}/>
            </div>
          </tabs_1.TabsContent>
        </tabs_1.Tabs>

        <div className="pt-2">
          <p className="text-sm text-muted-foreground break-all">{qrUrl}</p>
        </div>
      </card_1.CardContent>
      <card_1.CardFooter className="flex justify-between">
        <button_1.Button variant="outline" onClick={handleCopy}>
          <lucide_react_1.Copy className="mr-2 h-4 w-4"/>
          Copy URL
        </button_1.Button>
        <button_1.Button variant="outline" onClick={handleShare}>
          <lucide_react_1.Share2 className="mr-2 h-4 w-4"/>
          Share
        </button_1.Button>
        <button_1.Button onClick={handleDownload}>
          <lucide_react_1.Download className="mr-2 h-4 w-4"/>
          Download
        </button_1.Button>
      </card_1.CardFooter>
    </card_1.Card>);
}
