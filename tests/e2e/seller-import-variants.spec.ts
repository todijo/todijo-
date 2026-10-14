import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { dismissCookieConsent } from "./helpers";

const db = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const userId = `seller-import-${suffix}`;
const businessId = `seller-import-business-${suffix}`;
const storeId = `seller-import-store-${suffix}`;
const adminId = `seller-import-admin-${suffix}`;
const secret = "e2e-only-placeholder-secret-at-least-32-characters";

test.beforeAll(async () => {
  const databaseUrl = process.env.PLAYWRIGHT_DATABASE_URL;
  if (process.env.TODIJO_CI_DISPOSABLE_DATABASE !== "1" || !databaseUrl) {
    throw new Error("Seller import browser test requires the dedicated disposable Playwright database.");
  }
  const parsedDatabaseUrl = new URL(databaseUrl);
  if (parsedDatabaseUrl.hostname !== "127.0.0.1" || parsedDatabaseUrl.username !== "validation" || parsedDatabaseUrl.pathname !== "/todijo_browser" || parsedDatabaseUrl.port !== (process.env.PGPORT ?? "5432")) {
    throw new Error("Refusing to run seller import browser test against a non-disposable database.");
  }

  await db.$transaction(async tx => {
    await tx.user.createMany({ data: [
      { id: userId, firstName: "Import", lastName: "Seller", email: `${userId}@e2e.todijo.test`, role: "SELLER", emailVerified: true },
      { id: adminId, firstName: "Fixture", lastName: "Admin", email: `${adminId}@e2e.todijo.test`, role: "ADMIN", emailVerified: true },
    ] });
    await tx.sellerBusiness.create({ data: { id: businessId, ownerId: userId, maxStores: 1 } });
    await tx.store.create({ data: { id: storeId, businessId, ownerId: userId, name: `Import test store ${suffix}`, slug: storeId, country: "FR", city: "Paris", contactEmail: `${userId}@e2e.todijo.test`, status: "ACTIVE", sellerType: "PRIVATE", onboardingStatus: "VERIFIED", onboardingStep: 4 } });
    await tx.sellerBusiness.update({ where: { id: businessId }, data: { primaryStoreId: storeId, billingStoreId: storeId } });
    await tx.user.update({ where: { id: userId }, data: { primaryStoreId: storeId } });
    await tx.sellerSubscription.create({ data: { id: `seller-import-sub-${suffix}`, storeId, stripeSubscriptionId: `sub_e2e_import_${suffix}`, stripePriceId: "price_test_pro_monthly", plan: "pro", billingInterval: "monthly", status: "ACTIVE", currentPeriodStart: new Date(Date.now() - 86_400_000), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) } });
  });
});

test.afterAll(async () => {
  try {
    await db.$transaction(async tx => {
      await tx.sellerProductImportJob.deleteMany({ where: { businessId } });
      await tx.sellerSubscription.deleteMany({ where: { storeId } });
      await tx.product.deleteMany({ where: { storeId } });
      await tx.user.deleteMany({ where: { id: adminId } });
      // The import writes immutable SellerBusinessAuditEvent rows linked to this
      // fixture's business, store, and actor. Keep those roots intact; this test
      // is guarded to run only against the disposable browser database, which is
      // discarded with the CI job. UUID-scoped records cannot affect other tests.
    });
  } finally {
    await db.$disconnect();
  }
});

test("seller CSV preview and draft import persist four parent products and ten exact variants; re-import safely skips them", async ({ page }) => {
  test.setTimeout(120_000);
  const token = await new SignJWT({ userId, role: "SELLER", authVersion: 0 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
  await page.context().addCookies([{ name: "todijo_session", value: token, url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100", httpOnly: true, sameSite: "Lax" }]);
  const fixturePath = resolve(process.cwd(), "tests/fixtures/todijo_test_catalog.csv");
  const categories = [
    ["men", "men--tshirts--solide"],
    ["kids", "kids--shoes--sacs-d-ecole"],
    ["home", "home--storage--papeterie"],
    ["home", "home--textiles--oreillers"],
  ];

  await page.goto(`/en/seller/products/import?store=${storeId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Import your products" })).toBeVisible();
  await dismissCookieConsent(page);
  await expect(page.locator(".cookieConsent")).toBeHidden();

  async function previewAndCategorize() {
    await page.locator('input[type="file"]').setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Review file" }).click();
    await expect(page.getByText("Source rows: 10")).toBeVisible();
    await expect(page.getByText("Parent products: 4")).toBeVisible();
    await expect(page.getByText("Variants: 10")).toBeVisible();
    const groups = page.locator(".sellerExternalImportProductGroup");
    await expect(groups).toHaveCount(4);
    for (let index = 0; index < categories.length; index += 1) {
      const group = groups.nth(index);
      await group.locator("summary").click();
      const selects = group.locator(".sellerImportCategoryPicker select");
      await selects.nth(0).selectOption(categories[index][0]);
      await selects.nth(1).selectOption(categories[index][1]);
    }
    await expect(page.getByText("4 products are ready to be imported as drafts.")).toBeVisible();
  }

  await previewAndCategorize();
  const importResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/seller/products/import")
    && response.request().method() === "POST"
    && response.request().headers()["content-type"]?.includes("application/json"));
  await page.getByRole("button", { name: "Import as drafts" }).click();
  const importResponse = await importResponsePromise;
  const importResult = await importResponse.json() as { error?: string; status?: string; requestedCount?: number; importedCount?: number; failedCount?: number; skippedCount?: number; items?: Array<{ rowNumber: number; status: string; errorCode: string | null }> };
  expect(importResponse.ok(), `Import API returned ${importResponse.status()}: ${JSON.stringify(importResult)}`).toBeTruthy();
  expect(importResult, "first import should persist all ten fixture rows").toMatchObject({ status: "COMPLETED", requestedCount: 10, importedCount: 10, failedCount: 0, skippedCount: 0 });
  await expect(page.getByText("Rows processed: 10 imported, 0 skipped, 0 need correction.")).toBeVisible({ timeout: 30_000 });

  const products = await db.product.findMany({
    where: { storeId, name: { in: ["T-shirt coton test", "Sac à dos test", "Carnet A5 test", "Coussin décoratif test"] } },
    include: {
      options: { orderBy: { position: "asc" }, include: { values: true } },
      variants: { include: { values: { include: { optionValue: true } } } },
    },
    orderBy: { name: "asc" },
  });
  expect(products).toHaveLength(4);
  expect(products.every(product => product.status === "DRAFT")).toBeTruthy();
  expect(products.reduce((count, product) => count + product.variants.length, 0)).toBe(10);
  const variantsBySku = new Map(products.flatMap(product => product.variants.map(variant => [variant.sku, { product, variant }] as const)));
  const expected = [
    ["TEST-TOD-001", 12.9, 8, "men--tshirts--solide", "Bleu", "S"], ["TEST-TOD-002", 12.9, 12, "men--tshirts--solide", "Bleu", "M"],
    ["TEST-TOD-003", 12.9, 5, "men--tshirts--solide", "Noir", "S"], ["TEST-TOD-004", 12.9, 9, "men--tshirts--solide", "Noir", "M"],
    ["TEST-TOD-005", 24.9, 7, "kids--shoes--sacs-d-ecole", "Noir", "Unique"], ["TEST-TOD-006", 24.9, 4, "kids--shoes--sacs-d-ecole", "Vert", "Unique"],
    ["TEST-TOD-007", 4.5, 30, "home--storage--papeterie", "Rouge", "A5"], ["TEST-TOD-008", 4.5, 24, "home--storage--papeterie", "Bleu", "A5"],
    ["TEST-TOD-009", 16, 6, "home--textiles--oreillers", "Beige", "40x40"], ["TEST-TOD-010", 19, 3, "home--textiles--oreillers", "Gris", "50x50"],
  ] as const;
  for (const [sku, price, stock, category, color, size] of expected) {
    const record = variantsBySku.get(sku);
    expect(record, `persisted variant ${sku}`).toBeTruthy();
    expect(Number(record!.variant.priceOverride ?? record!.product.price)).toBe(price);
    expect(record!.variant.stock).toBe(stock);
    expect(record!.product.category).toBe(category);
    const attributes = record!.product.attributes as { color?: string; size?: string; variantAttributes?: Array<{ sku: string | null; values: Record<string, string> }> };
    for (const [field, value] of [["color", color], ["size", size]] as const) {
      const option = record!.product.options.find(candidate => candidate.name.toLocaleLowerCase() === field);
      if (option) {
        expect(record!.variant.values.some(entry => entry.optionValue.optionId === option.id && entry.optionValue.value === value), `${sku} ${field} option value`).toBeTruthy();
      } else {
        expect(attributes[field], `${sku} constant parent ${field}`).toBe(value);
      }
      expect(attributes.variantAttributes?.find(entry => entry.sku === sku)?.values[field], `${sku} source ${field}`).toBe(value);
    }
  }
  let job = await db.sellerProductImportJob.findFirst({ where: { storeId, createdById: userId }, orderBy: { createdAt: "desc" }, include: { items: true } });
  expect(job?.status).toBe("COMPLETED");
  expect(job?.items.filter(item => item.status === "IMPORTED")).toHaveLength(10);

  await previewAndCategorize();
  await page.getByRole("button", { name: "Import as drafts" }).click();
  await expect(page.getByText("Rows processed: 0 imported, 10 skipped, 0 need correction.")).toBeVisible({ timeout: 30_000 });
  job = await db.sellerProductImportJob.findFirst({ where: { storeId, createdById: userId }, orderBy: { createdAt: "desc" }, include: { items: true } });
  expect(job?.items.filter(item => item.status === "SKIPPED")).toHaveLength(10);
  expect(await db.product.count({ where: { storeId, name: { in: ["T-shirt coton test", "Sac à dos test", "Carnet A5 test", "Coussin décoratif test"] } } })).toBe(4);
});
