import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "..", "dist");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith("@/")) request = path.join(DIST, request.slice(2));
  return origResolve.call(this, request, ...args);
};

const { createKernel, bootKernel } = await import(pathToFileURL(path.join(DIST, "kernel", "index.js")).href);
const { newTenant, systemActor } = await import(pathToFileURL(path.join(DIST, "kernel", "tenant", "tenant.js")).href);
const { deriveCapabilities } = await import(
  pathToFileURL(path.join(DIST, "kernel", "tenant", "permission-map.js")).href
);

describe("reservation contact privacy", () => {
  it("masks phone/email/specialRequests without customer:view_pii", async () => {
    const tenant = newTenant({ orgId: "org-pii", venueId: "venue-pii" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });
    const admin = systemActor({ userId: "adm" });
    const host = { userId: "u-host", roles: ["host"], permissions: deriveCapabilities({ sub: "u-host", role: "host" }) };
    assert.ok(!host.permissions.includes("customer:view_pii"), "host must not hold the PII capability");

    const booked = await kernel.execute(
      "reservation.book",
      {
        reservationId: "r-pii",
        customerName: "A. Guest",
        partySize: 2,
        date: "2026-12-24",
        time: "19:00",
        phone: "+1-212-555-0199",
        email: "guest@example.com",
        specialRequests: "Severe peanut allergy",
      },
      admin,
    );
    assert.equal(booked.success, true);

    const full = await kernel.ask("get.reservation", { reservationId: "r-pii" }, admin);
    assert.equal(full.success, true);
    assert.equal(full.data.state.phone, "+1-212-555-0199");
    assert.equal(full.data.state.specialRequests, "Severe peanut allergy");

    const masked = await kernel.ask("get.reservation", { reservationId: "r-pii" }, host);
    assert.equal(masked.success, true);
    assert.equal(masked.data.state.phone, "•••0199");
    assert.equal(masked.data.state.email, "g•••@example.com");
    assert.equal(masked.data.state.specialRequests, "•••");

    const list = await kernel.ask("list.reservations.onDate", { date: "2026-12-24" }, host);
    assert.equal(list.success, true);
    const row = (list.data.rows ?? list.data).find((r) => r.id === "r-pii");
    assert.ok(row, "row present on the date board");
    assert.equal(row.phone, "•••0199");
    assert.equal(row.specialRequests, "•••");
    await kernel.shutdown();
  });
});
