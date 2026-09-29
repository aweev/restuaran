const path = require("path")
const fs = require("fs")
const Module = require("module")

const DIST = path.join(__dirname, "dist")
const origResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith("@/")) request = path.join(DIST, request.slice(2))
  return origResolve.call(this, request, ...args)
}

const { createKernel, bootKernel, collectSurface, buildSdkSource } = require("./dist/kernel")
const { newTenant } = require("./dist/kernel/tenant/tenant")

const OUT = path.join(__dirname, "sdk", "ros-sdk.ts")

// Boots a throwaway kernel (in-memory store, no sockets/timers), captures the
// live surface and writes the typed client. `--check` exits 1 when stale so CI
// can enforce `npm run kernel:sdk` after surface changes.
;(async () => {
  const kernel = createKernel({ tenant: newTenant({ orgId: "sdk-gen", venueId: "sdk-gen" }) })
  await bootKernel(kernel, { socket: null })
  const source = buildSdkSource(collectSurface(kernel))
  await kernel.shutdown()

  if (process.argv.includes("--check")) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : ""
    if (current !== source) {
      console.error("sdk/ros-sdk.ts is stale — run `npm run kernel:sdk` and commit the result.")
      process.exit(1)
    }
    console.log("sdk/ros-sdk.ts is up to date (" + source.length + " bytes).")
    return
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, source)
  console.log("wrote " + OUT + " (" + source.length + " bytes)")
})().catch((e) => {
  console.error("SDK GENERATION FAILED:", e)
  process.exit(1)
})