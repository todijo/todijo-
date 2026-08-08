import { expect, type Locator, type Page } from "@playwright/test";

export function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    const expectedNotFoundResponse = text.includes("Failed to load resource") && text.includes("404");
    if (message.type() === "error" && !expectedNotFoundResponse) errors.push(text);
  });
  return () => expect(errors, "unexpected browser runtime errors").toEqual([]);
}

export async function expectNoDocumentOverflow(page: Page, tolerance = 1) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(root.scrollWidth, body?.scrollWidth ?? 0) - root.clientWidth;
  });
  expect(overflow, "document should not overflow the viewport horizontally").toBeLessThanOrEqual(tolerance);
}

export async function expectWithinViewport(locator: Locator, page: Page, tolerance = 1) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box, "visible control should have a bounding box").not.toBeNull();
  expect(viewport, "test project should define a viewport").not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(-tolerance);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + tolerance);
}
