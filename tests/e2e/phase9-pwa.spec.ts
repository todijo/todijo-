import { expect, test } from "@playwright/test";
import { expectNoDocumentOverflow, expectWithinViewport } from "./helpers";

const cases = [
  { path: "/en/offline", lang: "en", dir: "ltr", title: "You’re offline" },
  { path: "/fr/offline", lang: "fr", dir: "ltr", title: "Vous êtes hors ligne" },
  { path: "/ar/offline", lang: "ar", dir: "rtl", title: "أنت غير متصل" },
] as const;

test("Phase 9 offline shell is localized, safe and contained at Android viewports", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    for (const item of cases) {
      await page.goto(item.path);
      await expect(page.locator("html")).toHaveAttribute("lang", item.lang);
      await expect(page.locator("html")).toHaveAttribute("dir", item.dir);
      await expect(page.getByRole("heading", { name: item.title })).toBeVisible();
      await expect(page.getByText(/current prices|prix, stocks|الأسعار والمخزون/)).toBeVisible();
      await expectWithinViewport(page.locator(".offlineActions button"), page);
      await expectNoDocumentOverflow(page);
    }
  }
});

test("Phase 9 manifest, worker and asset-links endpoints have safe headers and data", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const data = await manifest.json();
  expect(data).toMatchObject({ id: "/", scope: "/", display: "standalone", theme_color: "#16074c" });

  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBeTruthy();
  expect(worker.headers()["cache-control"]).toContain("no-cache");
  expect(worker.headers()["service-worker-allowed"]).toBe("/");

  const assetlinks = await request.get("/.well-known/assetlinks.json");
  expect(assetlinks.ok()).toBeTruthy();
  expect(await assetlinks.json()).toEqual([]);
});
