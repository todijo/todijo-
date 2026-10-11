import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";

const db = new PrismaClient();
const secret = "e2e-only-placeholder-secret-at-least-32-characters";
const suffix = randomUUID().slice(0, 8);
const ownerId = `siret-ui-owner-${suffix}`;
const adminId = `siret-ui-admin-${suffix}`;
const businessId = `siret-ui-business-${suffix}`;
const storeId = `siret-ui-store-${suffix}`;

test.beforeAll(async () => {
  const databaseUrl = process.env.PLAYWRIGHT_DATABASE_URL;
  if (process.env.TODIJO_CI_DISPOSABLE_DATABASE !== "1" || !databaseUrl) {
    throw new Error("Store-settings browser regression requires the dedicated disposable Playwright database.");
  }
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.username !== "validation" || parsed.pathname !== "/todijo_browser" || parsed.port !== (process.env.PGPORT ?? "5432")) {
    throw new Error("Refusing to run store-settings browser regression against a non-disposable database.");
  }

  await db.$transaction(async tx => {
    await tx.user.createMany({ data: [
      { id: ownerId, firstName: "SIRET", lastName: "Owner", email: `siret-owner-${suffix}@e2e.todijo.test`, role: "SELLER", emailVerified: true },
      { id: adminId, firstName: "Fixture", lastName: "Admin", email: `siret-admin-${suffix}@e2e.todijo.test`, role: "ADMIN", emailVerified: true },
    ] });
    await tx.store.create({ data: {
      id: storeId, name: `SIRET Verification ${suffix}`, slug: `siret-verification-${suffix}`, ownerId,
      country: "FR", city: "Paris", contactEmail: `siret-owner-${suffix}@e2e.todijo.test`, currency: "EUR", language: "fr",
      status: "PENDING", sellerType: "PROFESSIONAL", sellerLegalForm: "SOLE_TRADER", legalBusinessName: "Verified fixture business",
      businessRegistrationId: "123", businessAddress: "10 rue de test", businessPostalCode: "75001", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE",
      displayBusinessAddress: false, onboardingStatus: "VERIFIED", onboardingStep: 4,
    } });
    await tx.sellerBusiness.create({ data: {
      id: businessId, ownerId, primaryStoreId: storeId, billingStoreId: storeId, siren: "732829320", inseeVerificationState: "PENDING", maxStores: 1,
    } });
    await tx.store.update({ where: { id: storeId }, data: { businessId } });
    await tx.user.update({ where: { id: ownerId }, data: { primaryStoreId: storeId } });
    await tx.storeAccessGrant.create({ data: {
      storeId, grantedById: adminId, source: "ADMIN_GRANTED", plan: "pro",
      startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 30 * 86_400_000),
    } });
  });
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function authenticateSeller(page: import("@playwright/test").Page) {
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { authVersion: true } });
  const token = await new SignJWT({ userId: ownerId, role: "SELLER", authVersion: owner.authVersion })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  await page.context().addCookies([{ name: "todijo_session", value: token, url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100", httpOnly: true, sameSite: "Lax" }]);
}

test("edited SIRET is verified and address preference cards remain accessible in desktop, mobile, and RTL", async ({ page }) => {
  await authenticateSeller(page);
  await page.goto(`/en/seller/store-settings?store=${encodeURIComponent(storeId)}`);
  await expect(page.locator('input[name="businessRegistrationId"]')).toHaveCount(1);
  await expect(page.locator("#businessRegistrationId")).toHaveValue("123");

  let submitted: Record<string, unknown> | null = null;
  await page.route("**/api/seller/business/verification", async route => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state: "VERIFIED", code: "VERIFIED" }) });
  });
  await page.locator("#businessSiren").fill("732829320");
  await page.locator("#businessRegistrationId").fill("73282932000074");
  await page.getByRole("button", { name: "Verify my business" }).click();
  await expect(page.getByRole("status").filter({ hasText: "verified with INSEE" })).toBeVisible();
  expect(submitted).toMatchObject({ sellerType: "PROFESSIONAL", country: "FR", businessSiren: "732829320", businessRegistrationNumber: "73282932000074" });

  const cards = page.locator(".sellerBusinessAddressOption");
  const fullAddress = page.getByRole("radio", { name: "Yes, display my full professional address." });
  const countryOnly = page.getByRole("radio", { name: "No, display the country only." });
  await expect(cards).toHaveCount(2);
  await expect(countryOnly).toBeChecked();
  await fullAddress.focus();
  await page.keyboard.press("ArrowRight");
  if (!(await countryOnly.isChecked())) await page.keyboard.press("ArrowLeft");
  await expect(countryOnly).toBeChecked();
  await cards.nth(0).click();
  await expect(fullAddress).toBeChecked();

  const desktopBoxes = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
  expect(desktopBoxes[0]).not.toBeNull();
  expect(desktopBoxes[1]).not.toBeNull();
  expect(desktopBoxes[1]!.x).toBeGreaterThan(desktopBoxes[0]!.x);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBoxes = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
  expect(mobileBoxes[0]).not.toBeNull();
  expect(mobileBoxes[1]).not.toBeNull();
  expect(mobileBoxes[1]!.y).toBeGreaterThan(mobileBoxes[0]!.y);
  expect(mobileBoxes[1]!.x).toBe(mobileBoxes[0]!.x);

  await page.setViewportSize({ width: 320, height: 568 });
  await expect(fullAddress).toBeVisible();
  await expect(countryOnly).toBeVisible();

  await page.goto(`/ar/seller/store-settings?store=${encodeURIComponent(storeId)}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const rtlCards = page.locator(".sellerBusinessAddressOption");
  await expect(rtlCards).toHaveCount(2);
  await expect(rtlCards.nth(0)).toBeVisible();
  await expect(rtlCards.nth(1)).toBeVisible();
});
