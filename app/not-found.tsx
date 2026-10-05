import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center pos-fade-in">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><SearchX className="h-7 w-7 text-muted-foreground" /></div>
      <h2 className="text-2xl font-bold">Page not found</h2>
      <p className="max-w-sm text-sm text-muted-foreground">The screen you are looking for moved or never existed. Try the dashboard or search with Ctrl+K.</p>
      <div className="flex gap-2">
        <Button asChild><Link href="/dashboard">Back to dashboard</Link></Button>
        <Button asChild variant="outline"><Link href="/customer/menu">Customer menu</Link></Button>
      </div>
    </div>
  );
}
