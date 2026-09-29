"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OfflinePage;
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
const link_1 = __importDefault(require("next/link"));
function OfflinePage() {
    return (<div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center space-y-6 text-center">
        <div className="rounded-full bg-muted p-6">
          <lucide_react_1.WifiOff className="h-12 w-12 text-muted-foreground"/>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">You&apos;re offline</h1>
          <p className="text-muted-foreground">
            It looks like you&apos;ve lost your internet connection. Some features may be limited until you&apos;re back online.
          </p>
        </div>

        <div className="space-y-2">
          <button_1.Button className="w-full" onClick={() => {
            window.location.reload();
        }}>
            <lucide_react_1.RefreshCw className="mr-2 h-4 w-4"/>
            Try again
          </button_1.Button>

          <link_1.default href="/dashboard" passHref>
            <button_1.Button variant="outline" className="w-full">
              Go to Dashboard
            </button_1.Button>
          </link_1.default>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Don&apos;t worry, any changes you make while offline will be saved and synced when you&apos;re back online.</p>
        </div>
      </div>
    </div>);
}
