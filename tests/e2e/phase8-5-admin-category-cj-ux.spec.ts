import { expect, test } from "@playwright/test";

test("desktop categories open only on click and close outside or with Escape", async ({ page }) => {
  await page.goto("/fr/e2e-ux?view=home", { waitUntil: "domcontentloaded" });
  const category = page.locator(".marketQuickCategory").first();
  await category.hover();
  await expect(page.locator("#market-category-mega-menu")).toHaveCount(0);
  await expect(category).toHaveAttribute("aria-expanded", "false");
  await category.click();
  await expect(page.locator("#market-category-mega-menu")).toBeVisible();
  await expect(category).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#market-category-mega-menu header a")).toHaveAttribute("href", /\/fr\/search\?category=/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#market-category-mega-menu")).toHaveCount(0);
  await category.click();
  await page.locator(".discoveryHero").click({ position: { x: 10, y: 10 } });
  await expect(page.locator("#market-category-mega-menu")).toHaveCount(0);
});

test("admin controls wrap without overflow at desktop, mobile and Arabic RTL", async ({ page }) => {
  for (const entry of [{ locale: "en", width: 1440 }, { locale: "fr", width: 390 }, { locale: "ar", width: 320 }]) {
    await page.setViewportSize({ width: entry.width, height: 900 });
    await page.goto(`/${entry.locale}/e2e-ux?view=phase8-5-admin`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".adminHeroActions")).toContainText("Stripe Connect readiness");
    await expect(page.locator(".adminDropshippingAction")).toBeVisible();
    expect(await page.locator("html").evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});

test("CJ import reports progress immediately and prevents duplicate submission", async ({ page }) => {
  let createCalls = 0;
  await page.route("**/api/admin/supplier-products/bulk-import", async route => {
    createCalls++;
    await new Promise(resolve => setTimeout(resolve, 1200));
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "EXPECTED_TEST_FAILURE" }) });
  });
  await page.goto("/fr/e2e-ux?view=phase8-5-cj", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.locator('textarea[name="identifiers"]').fill("CJ-TEST-1");
  const action = page.locator(".supplierImportAction");
  await action.click();
  await expect(action).toBeDisabled();
  await expect(page.locator(".supplierImportProgress")).toContainText("Importation en cours");
  await action.click({ force: true });
  await expect(page.locator(".supplierImportError")).toHaveAttribute("role", "alert");
  expect(createCalls).toBe(1);
});
