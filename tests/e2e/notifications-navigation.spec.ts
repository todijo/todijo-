import { expect, test, type Page } from "@playwright/test";
import { expectNoDocumentOverflow } from "./helpers";

async function mockAuthenticatedSession(page: Page) {
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true, name: "Test Buyer" }) }));
}

for (const scenario of [
  { locale: "en", width: 390, menu: "Open menu", label: "Notifications" },
  { locale: "fr", width: 320, menu: "Ouvrir le menu", label: "Notifications" },
  { locale: "ar", width: 390, menu: "فتح القائمة", label: "الإشعارات" },
]) {
  test(`authenticated ${scenario.locale} mobile menu discovers localized Notifications`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: 844 });
    await mockAuthenticatedSession(page);
    await page.goto(`/${scenario.locale}/e2e-ux?view=home`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: scenario.menu }).click();
    const link = page.getByRole("link", { name: scenario.label });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", `/${scenario.locale}/notifications`);
    await expectNoDocumentOverflow(page);
    if (scenario.locale === "ar") await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
}

test("unauthenticated mobile menu does not expose Notifications", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
  await page.goto("/en/e2e-ux?view=home", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "Notifications" })).toHaveCount(0);
});
