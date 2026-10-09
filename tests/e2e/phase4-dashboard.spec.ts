import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { sellerActionCenterCopy } from "../../i18n/seller-action-center";

const db = new PrismaClient();
const secret = "e2e-only-placeholder-secret-at-least-32-characters";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const userId = `phase4-dashboard-${suffix}`;
const businessId = `phase4-dashboard-business-${suffix}`;
const storeId = `phase4-dashboard-store-${suffix}`;

async function addSession(page: import("@playwright/test").Page) {
  const value = await new SignJWT({ userId, role: "SELLER", authVersion: 0 })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  await page.context().addCookies([{ name: "todijo_session", value, url: "http://localhost:3100", httpOnly: true, sameSite: "Lax" }]);
}

test.beforeAll(async () => {
  await db.user.create({ data: { id: userId, firstName: "Action", lastName: "Seller", email: `${suffix}@phase4.invalid`, role: "SELLER", emailVerified: true, authVersion: 0 } });
  await db.sellerBusiness.create({ data: { id: businessId, ownerId: userId, maxStores: 1 } });
  await db.store.create({ data: { id: storeId, name: `Action store ${suffix}`, slug: `phase4-${suffix}`, country: "FR", city: "Paris", contactEmail: `${suffix}@phase4.invalid`, ownerId: userId, businessId, status: "ACTIVE", sellerType: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE", onboardingStatus: "VERIFIED", onboardingStep: 4 } });
  await db.sellerBusiness.update({ where: { id: businessId }, data: { billingStoreId: storeId } });
  await db.user.update({ where: { id: userId }, data: { primaryStoreId: storeId } });
  await db.product.create({ data: { id: `phase4-low-${suffix}`, storeId, name: "Low-stock fixture", slug: `phase4-low-${suffix}`, description: "Disposable dashboard fixture", price: 5, category: "test", condition: "NEUF", images: [], status: "PUBLISHED", stock: 2, complianceDeclaredAt: new Date() } });
  await db.product.create({ data: { id: `phase4-out-${suffix}`, storeId, name: "Out-stock fixture", slug: `phase4-out-${suffix}`, description: "Disposable dashboard fixture", price: 5, category: "test", condition: "NEUF", images: [], status: "PUBLISHED", stock: 0, complianceDeclaredAt: new Date() } });
  await db.product.create({ data: { id: `phase4-variants-${suffix}`, storeId, name: "Variant-stock fixture", slug: `phase4-variants-${suffix}`, description: "Disposable dashboard fixture", price: 5, category: "test", condition: "NEUF", images: [], status: "PUBLISHED", stock: 1, complianceDeclaredAt: new Date(), variants: { create: [{ id: `phase4-variant-low-${suffix}`, combinationKey: "low", stock: 3 }, { id: `phase4-variant-out-${suffix}`, combinationKey: "out", stock: 0 }] } } });
});

test.afterAll(async () => { await db.$disconnect(); });

test("seller dashboard action center shows real simple and variant stock alerts with usable RTL layout", async ({ page }) => {
  await addSession(page);
  const desktop = await page.goto("/en/dashboard");
  expect(desktop?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const alerts = page.locator(".sellerStockActionAlerts:visible");
  await expect(alerts).toHaveCount(1);
  await expect(alerts).toBeVisible();
  const lowStockCard=alerts.getByRole("link").filter({hasText:sellerActionCenterCopy("en").lowStock});
  const outOfStockCard=alerts.getByRole("link").filter({hasText:sellerActionCenterCopy("en").outOfStock});
  await expect(lowStockCard).toContainText("2");
  await expect(outOfStockCard).toContainText("2");
  await expect(lowStockCard).toHaveAttribute("href", new RegExp(`/en/seller/products\\?store=${storeId}\\&status=PUBLISHED`));
  await expect(outOfStockCard).toHaveAttribute("href", new RegExp(`/en/seller/products\\?store=${storeId}\\&status=PUBLISHED`));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/dashboard");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const rtlAlerts = page.locator(".sellerStockActionAlerts:visible");
  await expect(rtlAlerts).toHaveCount(1);
  await expect(rtlAlerts).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
});

test("seller report downloads are localized and remain scoped to the authorized store", async ({ page }) => {
  await addSession(page);
  await page.goto("/fr/dashboard");
  await expect(page.getByRole("link", { name: "Télécharger le rapport" })).toHaveAttribute("href", `/api/seller/reports/export?type=finance&store=${storeId}&locale=fr`);
  await expect(page.getByRole("link", { name: "Télécharger le stock" })).toHaveAttribute("href", `/api/seller/reports/export?type=stock&store=${storeId}&locale=fr`);

  const finance = await page.request.get(`/api/seller/reports/export?type=finance&store=${storeId}&locale=fr&month=2026-10`);
  expect(finance.status()).toBe(200);
  expect(finance.headers()["content-type"]).toContain("text/csv");
  expect(finance.headers()["content-disposition"]).toContain(`todijo-finance-2026-10-${storeId}.csv`);
  expect(await finance.text()).toContain("Date de paiement,Commande,Devise");

  const stock = await page.request.get(`/api/seller/reports/export?type=stock&store=${storeId}&locale=en`);
  expect(stock.status()).toBe(200);
  const stockCsv = await stock.text();
  expect(stockCsv).toContain("Product,Variant,SKU,Stock,Price,Status");
  expect(stockCsv).toContain("Low-stock fixture");
  expect(stockCsv).toContain("Variant-stock fixture,low");
  expect(stockCsv).toContain("Variant-stock fixture,out");

  const otherStore = await page.request.get("/api/seller/reports/export?type=stock&store=unowned-store&locale=en");
  expect(otherStore.status()).toBe(403);
  expect(await otherStore.text()).not.toContain("Low-stock fixture");
});
