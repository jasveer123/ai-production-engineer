import { expect, test } from "@playwright/test"

test("login page shows the sign-in form", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
  await expect(page.getByLabel("Work email")).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeEnabled()
})

test("login links to account creation", async ({ page }) => {
  await page.goto("/login")
  await page
    .getByRole("link", { name: /sign up|create/i })
    .first()
    .click()
  await expect(page).toHaveURL(/\/sign-up/)
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()
})

test("password reset validates the email before sending", async ({ page }) => {
  await page.goto("/forgot-password")
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible()
  await page.getByLabel("Work email").fill("not-an-email")
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByText("That email does not look right.")).toBeVisible()
})
