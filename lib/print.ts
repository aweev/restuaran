"use client"

/**
 * Single print path for receipts and Day Close.
 *
 * Transport order: (1) LAN print-service POST when `printerEndpoint` is set
 * in venue settings (ESC/POS driver on the network), else (2) browser
 * `window.print()` (thermal driver on tablets). A failed/blocked job stays
 * queued with an explicit retry — the sale is never stuck behind a printer.
 */

export interface PrintJob {
  id: string
  title: string
  html: string
  createdAt: string
  attempts: number
  status: "queued" | "done" | "failed"
}

const KEY = "pos.print.queue"

function load(): PrintJob[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(jobs: PrintJob[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(jobs.slice(-50)))
  } catch {
    /* ignore */
  }
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `print-${Date.now()}-${Math.random().toString(36).slice(2)}`

function venuePrintConfig(): { endpoint: string; footer: string } {
  try {
    const raw = window.localStorage.getItem("pos.venue.settings")
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      endpoint: typeof parsed.printerEndpoint === "string" ? parsed.printerEndpoint.trim() : "",
      footer: typeof parsed.receiptFooter === "string" && parsed.receiptFooter ? parsed.receiptFooter : "Thank you — come again!",
    }
  } catch {
    return { endpoint: "", footer: "Thank you — come again!" }
  }
}

function withFooter(html: string): string {
  const { footer } = venuePrintConfig()
  const esc = footer.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  return `${html}<div class="footer"><p>${esc}</p></div>`
}

async function postToPrintService(title: string, html: string): Promise<boolean> {
  const { endpoint } = venuePrintConfig()
  if (!endpoint) return false
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, html }),
    })
    return res.ok
  } catch {
    return false
  }
}
function openPrintWindow(title: string, html: string): boolean {
  try {
    const w = window.open("", `_print_${Date.now()}`, "width=400,height=600")
    if (!w) return false
    w.document.write(
      `<!DOCTYPE html><html><head><title>${title}</title><style>` +
        `body{font-family:'Courier New',monospace;width:80mm;margin:0 auto;padding:10px;font-size:12px;color:#000}` +
        `.text-center{text-align:center}.font-bold{font-weight:bold}` +
        `</style></head><body>${html}<script>window.onload=function(){window.print()}<\/script></body></html>`,
    )
    w.document.close()
    return true
  } catch {
    return false
  }
}

export function queuePrintJob(title: string, html: string): PrintJob {
  const job: PrintJob = {
    id: uid(),
    title,
    html,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "queued",
  }
  const jobs = [...load(), job]
  persist(jobs)
  return job
}

export async function printHtml(title: string, html: string): Promise<{ ok: boolean; jobId: string }> {
  const body = withFooter(html)
  const job = queuePrintJob(title, body)
  job.attempts += 1
  // LAN print-service first when configured; browser dialog otherwise.
  const viaLan = await postToPrintService(title, body)
  const ok = viaLan || openPrintWindow(title, body)
  const jobs = load().map((j) => (j.id === job.id ? { ...j, attempts: job.attempts, status: ok ? ("done" as const) : ("failed" as const) } : j))
  persist(jobs)
  return { ok, jobId: job.id }
}

/** Retry a failed/blocked print job. Resolves true when it printed. */
export async function retryPrintJob(jobId: string): Promise<boolean> {
  const jobs = load()
  const job = jobs.find((j) => j.id === jobId)
  if (!job) return false
  const viaLan = await postToPrintService(job.title, job.html)
  const ok = viaLan || openPrintWindow(job.title, job.html)
  persist(jobs.map((j) => (j.id === jobId ? { ...j, attempts: j.attempts + 1, status: ok ? ("done" as const) : ("failed" as const) } : j)))
  return ok
}

export function pendingPrintJobs(): PrintJob[] {
  return load().filter((j) => j.status === "failed" || j.status === "queued")
}
