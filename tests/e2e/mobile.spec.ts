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
  await page.goto("/en/info/about");

  await expect(page.getByRole("heading", { name: "About Todijo" }).first()).toBeVisible();
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

test("mobile search filters open as a full-height sheet without squeezing results", async ({ page }) => {
  await page.goto("/en/e2e-ux");
  const results = page.locator(".resultsArea");
  const widthBefore = await results.evaluate((element) => element.getBoundingClientRect().width);
  await page.getByRole("button", { name: "Filters" }).click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  await expect(dialog).toBeVisible();
  const sheet = await dialog.boundingBox();
  expect(sheet?.height).toBeGreaterThanOrEqual(800);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const widthAfter = await results.evaluate((element) => element.getBoundingClientRect().width);
  expect(widthAfter).toBe(widthBefore);
});

test("mobile Categories opens the compact category drawer and preserves locale", async ({ page }) => {
  await page.route(/\/en\/search\?/, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Search</title>" }));
  await page.goto("/en/e2e-ux?view=home");
  await dismissCookieConsent(page);
  await page.getByRole("button", { name: "Categories" }).last().click();
  const drawer = page.getByRole("dialog", { name: "Mobile navigation" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Categories" }).click();
  await expect(drawer.getByRole("link", { name: "Electronics" })).toBeVisible();
  await Promise.all([page.waitForURL(/\/en\/search\?category=/, { waitUntil: "commit" }), drawer.getByRole("link", { name: "Electronics" }).click()]);
});

test("mobile compliance fields and contact seller remain readable", async ({ page }) => {
  await page.goto("/ar/e2e-ux?view=seller");
  await dismissCookieConsent(page);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const complianceInput = page.locator("#responsiblePartyName");
  await expect(complianceInput).toBeVisible();
  await expect(complianceInput).toHaveCSS("color", "rgb(23, 59, 48)");

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
