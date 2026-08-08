import { expect, test } from "@playwright/test";
import { collectRuntimeErrors, expectNoDocumentOverflow, expectWithinViewport } from "./helpers";

test("narrow mobile authentication controls fit the viewport", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);
  await page.goto("/en/login");

  await expectWithinViewport(page.getByLabel("Email address"), page);
  await expectWithinViewport(page.getByLabel("Password"), page);
  await expectWithinViewport(page.getByRole("button", { name: "Sign in" }), page);
  await expectNoDocumentOverflow(page);
  assertNoRuntimeErrors();
});

test("narrow mobile RTL route does not overflow", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);
  await page.goto("/ar/login");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("main")).toBeVisible();
  await expectNoDocumentOverflow(page);
  assertNoRuntimeErrors();
});

test("narrow mobile public shell, menu, and footer remain usable", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);
  await page.goto("/en/info/about");

  await expectWithinViewport(page.getByRole("button", { name: "Open menu" }), page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Mobile navigation" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).last().click();
  const footer = page.locator("footer.marketplaceFooter");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeVisible();
  await expectNoDocumentOverflow(page);
  assertNoRuntimeErrors();
});
