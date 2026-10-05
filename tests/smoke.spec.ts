import { test, expect } from "@playwright/test"

const ADMIN_EMAIL = "admin@restaurant.com"
const ADMIN_PASSWORD = "admin123"

test.describe("Critical Path Smoke Test", () => {
  test("Login → verify cookie set → hard reload → session restored → create order → kitchen receives → checkout → payment recorded", async ({
    page,
    context,
  }) => {
    await test.step("1. Login and verify auth cookies set", async () => {
      await page.goto("/login")
      await page.fill("#email", ADMIN_EMAIL)
      await page.fill("#password", ADMIN_PASSWORD)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL(/.*dashboard/)

      const cookies = await context.cookies()
      const accessTokenCookie = cookies.find((c) => c.name === "posAccessToken")
      const refreshTokenCookie = cookies.find((c) => c.name === "posRefreshToken")

      expect(accessTokenCookie).toBeTruthy()
      expect(refreshTokenCookie).toBeTruthy()
      expect(accessTokenCookie!.value.length).toBeGreaterThan(0)
      expect(refreshTokenCookie!.value.length).toBeGreaterThan(0)
    })

    await test.step("2. Hard reload and verify session restored via /api/auth/me", async () => {
      await page.reload({ waitUntil: "networkidle" })

      const meResponse = await page.request.get("/api/auth/me")
      expect(meResponse.ok()).toBeTruthy()

      const meData = await meResponse.json()
      expect(meData.user).toBeTruthy()
      expect(meData.user.email).toBe(ADMIN_EMAIL)
      expect(meData.user.role).toBe("admin")
    })

    await test.step("3. Create order via kernel (API) and verify kitchen receives it", async () => {
      await page.goto("/dashboard/orders/new")
      await expect(page.locator("h2:has-text('New Order')")).toBeVisible()

      await page.waitForSelector("text=Grid View", { state: "visible" })
      await page.waitForTimeout(1000)

      const addButtons = page.locator('button:has-text("Add to Order")')
      await expect(addButtons.first()).toBeVisible({ timeout: 10000 })
      await addButtons.first().click()

      await page.waitForSelector("text=Cart (1)", { state: "visible" })

      await page.locator("button:has-text('Create Order')").click()
      await expect(page.locator("text=Order created successfully")).toBeVisible({ timeout: 10000 })

      await expect(page).toHaveURL(/\/dashboard\/orders\/[a-zA-Z0-9-]+/)
      const orderUrl = page.url()
      const orderId = orderUrl.split("/dashboard/orders/")[1]

      await page.goto("/dashboard/kitchen/display")
      await expect(page.locator("h2:has-text('Kitchen Display System')")).toBeVisible()

      await expect(page.locator(`text=${orderId.substring(0, 8)}`)).toBeVisible({ timeout: 10000 })
    })

    await test.step("4. Checkout and verify payment recorded", async () => {
      const orderUrl = page.url()
      const orderId = orderUrl.split("/dashboard/orders/")[1] ?? (await page.locator("text=/Order #/").first().textContent())?.split("#")[1]?.split(" ")[0] ?? ""

      await page.goto(`/dashboard/orders/${orderId}`)
      await expect(page.locator(`text=Order #${orderId.substring(0, 8)}`)).toBeVisible()

      const totalText = await page.locator("text=/Total: \\$[0-9.]+/").first().textContent()
      const total = parseFloat(totalText!.match(/\\$([0-9.]+)/)![1])

      await page.fill("#amount", total.toFixed(2))
      await page.check("#cash")
      await page.click('button:has-text("Process Full Payment")')

      await expect(page.locator("text=Payment processed successfully")).toBeVisible({ timeout: 10000 })

      const paymentResponse = await page.request.get(`/api/orders/${orderId}/payments`)
      expect(paymentResponse.ok()).toBeTruthy()

      const payments = await paymentResponse.json()
      expect(payments.length).toBeGreaterThan(0)

      const lastPayment = payments[payments.length - 1]
      expect(lastPayment.amount).toBe(total)
      expect(lastPayment.method).toBe("cash")
    })
  })
})