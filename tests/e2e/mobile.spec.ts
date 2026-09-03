import { expect, test } from "@playwright/test";
import { collectRuntimeErrors, dismissCookieConsent, expectNoDocumentOverflow, expectWithinViewport } from "./helpers";

test("mobile authentication entry keeps critical controls usable", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);
  const response = await page.goto("/en/login");

  expect(response?.ok()).toBeTruthy();
  await dismissCookieConsent(page);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expectWithinViewport(page.getByLabel("Email address"), page);
  await expectWithinViewport(page.getByLabel("Password"), page);
  await expectWithinViewport(page.getByRole("button", { name: "Sign in" }), page);
  await expectNoDocumentOverflow(page);

  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/en\/forgot-password$/);
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  await expectNoDocumentOverflow(page);
  assertNoRuntimeErrors();
});

test("mobile localized route renders in French", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);
  await page.goto("/fr/login");

  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("main")).toBeVisible();
  await expectNoDocumentOverflow(page);
  assertNoRuntimeErrors();
});

test("mobile menu opens, closes, restores scrolling, and navigates", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);
  await page.goto("/en/info/about");
  const menu = page.getByRole("button", { name: "Open menu" });

  await menu.click();
  await expect(page.getByRole("dialog", { name: "Mobile navigation" })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.getByRole("button", { name: "Close" }).last().click();
  await expect(page.getByRole("dialog", { name: "Mobile navigation" })).toBeHidden();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

  await menu.click();
  await page.getByRole("dialog", { name: "Mobile navigation" }).getByRole("link", { name: "Account" }).click();
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expectNoDocumentOverflow(page);
  assertNoRuntimeErrors();
});

test("mobile public information page and footer stay responsive", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);
  const response = await page.goto("/en/info/about");

  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { level: 1, name: "A marketplace for buyers and independent sellers" })).toBeVisible();
  const footer = page.locator("footer.marketplaceFooter");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeVisible();
  await expectNoDocumentOverflow(page);
  assertNoRuntimeErrors();
});

test("mobile protected route redirects safely", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);
  await page.goto("/en/dashboard");

  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expectNoDocumentOverflow(page);
  assertNoRuntimeErrors();
});

test("mobile unknown route renders localized not-found content", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);
  await page.goto("/en/mobile-route-does-not-exist");

  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expectNoDocumentOverflow(page);
  assertNoRuntimeErrors();
});

test("mobile RTL information page preserves direction and layout", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);
  await page.goto("/ar/info/about");

  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("main")).toBeVisible();
  await expectNoDocumentOverflow(page);
  assertNoRuntimeErrors();
});

test("mobile canonical filter dock opens facets without squeezing results", async ({ page }) => {
  await page.goto("/en/e2e-ux");
  const results = page.locator(".resultsArea");
  const widthBefore = await results.evaluate((element) => element.getBoundingClientRect().width);
  const dock = page.getByRole("region", { name: "Filters" });
  await expect(dock).toBeVisible();
  const sortFacet = dock.locator('details:has(input[name="sort-dock"])');
  await sortFacet.locator("summary").click();
  const sortPopover = sortFacet.locator(".marketFacetPopover");
  await expect(sortPopover).toBeVisible();
  await expect(sortFacet.getByRole("radio")).toHaveCount(4);
  await expect(sortFacet.getByRole("radio").first()).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(sortPopover).toBeHidden();
  await dock.getByRole("button", { name: "In stock" }).click();
  await expect(dock.getByRole("button", { name: "In stock" })).toHaveAttribute("aria-pressed", "true");
  await expect(sortPopover).toBeHidden();
  const widthAfter = await results.evaluate((element) => element.getBoundingClientRect().width);
  expect(widthAfter).toBe(widthBefore);
});

test("mobile category browser opens from bottom navigation and preserves locale", async ({ page }) => {
  await page.route(/\/en\/search\?/, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Search</title>" }));
  await page.goto("/en/e2e-ux?view=home");
  await dismissCookieConsent(page);

  const bottomNavigation = page.locator("nav.buyerMobileBottomNav");
  await expect(bottomNavigation).toBeVisible();
  await bottomNavigation.getByRole("button", { name: "Categories" }).click();

  const drawer = page.getByRole("dialog", { name: "Mobile navigation" });
  await expect(drawer).toBeVisible();
  const browser = drawer.locator(".buyerMobileCategoryBrowser");
  await expect(browser).toBeVisible();
  await expect(browser.getByRole("tab")).toHaveCount(14);

  const category = browser.locator(".buyerMobileCategoryAll");
  await expect(category).toHaveAttribute("href", /^\/en\/search\?category=/);
  await Promise.all([page.waitForURL(/\/en\/search\?category=/, { waitUntil: "commit" }), category.click()]);
});

test("mobile compliance fields and contact seller remain readable", async ({ page }) => {
  await page.goto("/ar/e2e-ux?view=seller");
  await dismissCookieConsent(page);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const complianceInput = page.locator('input[name="productIdentifier"]');
  await expect(complianceInput).toBeVisible();
  const complianceColors = await complianceInput.evaluate((element) => { const style = getComputedStyle(element); return [style.color, style.backgroundColor]; });
  expect(complianceColors[0]).not.toBe(complianceColors[1]);

  await page.goto("/fr/e2e-ux?view=contact");
  await dismissCookieConsent(page);
  await expectNoDocumentOverflow(page);
  const askButton = page.getByRole("button", { name: "Demander au vendeur" });
  const buttonBox = await askButton.boundingBox();
  expect(buttonBox?.width).toBeLessThan(page.viewportSize()!.width);
  await askButton.click();
  const textarea = page.getByRole("textbox");
  await textarea.fill("Trop court");
  await expect(page.getByRole("button", { name: "Envoyer le message" })).toBeDisabled();
  await expect(page.locator(".messageError")).toHaveCount(0);
  await textarea.fill("Ce message est assez long.");
  await expect(page.getByRole("button", { name: "Envoyer le message" })).toBeEnabled();
});

test("mobile RTL product information and report dialog do not overflow", async ({ page }) => {
  await page.goto("/ar/e2e-ux?view=product-lower");
  await dismissCookieConsent(page);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expectNoDocumentOverflow(page);
  await page.getByRole("button", { name: "الإبلاغ عن هذا المنتج" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("mobile RTL shipping settings stay readable and contained", async ({ page }) => {
  await page.goto("/ar/e2e-ux?view=shipping");
  await dismissCookieConsent(page);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const section = page.locator("#shipping");
  await expect(section).toBeVisible();
  const box = await section.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(page.locator("#shippingMethodName")).toHaveCSS("color", "rgb(23, 59, 48)");
  await expect(page.locator("#shippingMethodName")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("mobile RTL supplier management stays readable and contained", async ({ page }) => {
  await page.goto("/ar/e2e-ux?view=supplier");
  await dismissCookieConsent(page);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".supplierManager")).toBeVisible();
  await expect(page.locator(".supplierImportForm")).toHaveCSS("grid-template-columns", /\d+(\.\d+)?px/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
