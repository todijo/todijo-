import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";

const db = new PrismaClient();
const secret = "e2e-only-placeholder-secret-at-least-32-characters";
const suffix = randomUUID().slice(0, 8);
const ownerId = `url-owner-${suffix}`;
const pendingOwnerId = `url-pending-owner-${suffix}`;
const adminId = `url-platform-admin-${suffix}`;
const attackerId = `url-unrelated-${suffix}`;
const businessId = `url-business-${suffix}`;
const publicStoreId = `url-store-${suffix}`;
const subordinateStoreId = `url-sub-store-${suffix}`;
const pendingStoreId = `url-pending-store-${suffix}`;
const platformStoreId = `url-platform-store-${suffix}`;
const productId = `url-product-${suffix}`;
const platformProductId = `url-platform-product-${suffix}`;
const originalSlug = `t-vetement-${suffix}`;
const subordinateSlug = `subordinate-url-${suffix}`;
const renamedSubordinateSlug = `subordinate-renamed-${suffix}`;
const firstSlug = `aln-traduction-${suffix}`;
const secondSlug = `aln-traduction-second-${suffix}`;
const thirdSlug = `aln-traduction-alt-${suffix}`;
const finalSlug = `aln-traduction-final-${suffix}`;
const pendingOldSlug = `pending-legacy-${suffix}`;

test.beforeAll(async () => {
  const databaseUrl = process.env.PLAYWRIGHT_DATABASE_URL;
  if (process.env.TODIJO_CI_DISPOSABLE_DATABASE !== "1" || !databaseUrl) throw new Error("Store URL lifecycle E2E requires the dedicated disposable Playwright database.");
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  const knownDisposable = parsed.username === "validation" && databaseName === "todijo_browser"
    || parsed.username === "lifecycle" && databaseName === "todijo_lifecycle_validation";
  if (parsed.hostname !== "127.0.0.1" || parsed.port !== (process.env.PGPORT ?? "5432") || !knownDisposable) throw new Error("Refusing to run store URL lifecycle E2E against a non-disposable database.");

  await db.$transaction(async tx => {
    await tx.user.createMany({ data: [
      { id: ownerId, firstName: "ALN", lastName: "Owner", email: `url-owner-${suffix}@e2e.todijo.test`, role: "SELLER", emailVerified: true, stripeAccountId: `acct_url_${suffix}`, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true },
      { id: pendingOwnerId, firstName: "Pending", lastName: "Owner", email: `url-pending-${suffix}@e2e.todijo.test`, role: "SELLER", emailVerified: true },
      { id: adminId, firstName: "Platform", lastName: "Admin", email: `url-admin-${suffix}@e2e.todijo.test`, role: "ADMIN", emailVerified: true },
      { id: attackerId, firstName: "Unrelated", lastName: "Buyer", email: `url-attacker-${suffix}@e2e.todijo.test`, role: "CUSTOMER", emailVerified: true },
    ] });
    await tx.sellerBusiness.create({ data: { id: businessId, ownerId, maxStores: 3 } });
    await tx.store.createMany({ data: [
      { id: publicStoreId, name: `ALN URL ${suffix}`, slug: originalSlug, ownerId, businessId, country: "FR", city: "Lille", contactEmail: `url-owner-${suffix}@e2e.todijo.test`, currency: "EUR", language: "fr", status: "ACTIVE", onboardingStatus: "VERIFIED", onboardingStep: 4, sellerType: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE" },
      { id: subordinateStoreId, name: `ALN Subordinate ${suffix}`, slug: subordinateSlug, ownerId, businessId, country: "FR", city: "Lille", contactEmail: `url-owner-${suffix}@e2e.todijo.test`, currency: "EUR", language: "fr", status: "PENDING", onboardingStatus: "IN_PROGRESS", onboardingStep: 2, sellerType: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE" },
      { id: pendingStoreId, name: `Pending URL ${suffix}`, slug: `pending-url-${suffix}`, ownerId: pendingOwnerId, country: "FR", city: "Paris", contactEmail: `url-pending-${suffix}@e2e.todijo.test`, currency: "EUR", language: "fr", status: "PENDING", onboardingStatus: "IN_PROGRESS", onboardingStep: 2, sellerType: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE" },
      { id: platformStoreId, name: `Platform URL ${suffix}`, slug: `platform-cj-${suffix}`, ownerId: adminId, country: "US", city: "New York", contactEmail: `url-admin-${suffix}@e2e.todijo.test`, currency: "USD", language: "en", status: "ACTIVE", sellerType: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE" },
    ] });
    await tx.sellerBusiness.update({ where: { id: businessId }, data: { primaryStoreId: publicStoreId, billingStoreId: publicStoreId } });
    await tx.user.update({ where: { id: ownerId }, data: { primaryStoreId: publicStoreId } });
    await tx.product.create({ data: { id: productId, storeId: publicStoreId, name: "URL lifecycle fixture", slug: `url-lifecycle-${suffix}`, description: "Synthetic product retained during a URL rename.", price: 12, currency: "EUR", category: "test", condition: "NEUF", images: [], status: "PUBLISHED" } });
    await tx.product.create({ data: { id: platformProductId, storeId: platformStoreId, name: "Synthetic CJ platform product", slug: `platform-url-lifecycle-${suffix}`, description: "Admin/CJ product must remain unchanged.", price: 20, currency: "USD", category: "test", condition: "NEUF", images: [], status: "PUBLISHED" } });
    await tx.storeSlugHistory.create({ data: { slug: pendingOldSlug, storeId: pendingStoreId } });
  });
});

test.afterAll(async () => { await db.$disconnect(); });

async function authenticate(page: Page, userId: string, role: "SELLER" | "ADMIN" | "CUSTOMER") {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { authVersion: true } });
  const token = await new SignJWT({ userId, role, authVersion: user.authVersion }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
  await page.context().addCookies([{ name: "todijo_session", value: token, url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100", httpOnly: true, sameSite: "Lax" }]);
}

test("store URL is explicit, cooldown-protected, redirects old slugs, and keeps unavailable status private", async ({ page, request }) => {
  await authenticate(page, ownerId, "SELLER");
  await page.goto(`/fr/seller/store-settings?store=${encodeURIComponent(publicStoreId)}`);
  await expect(page.locator(".storeUrlSettings")).toContainText(`ALN URL ${suffix}`);
  await expect(page.locator(".storeUrlSettings a")).toHaveAttribute("href", `/fr/store/${originalSlug}`);
  const displayNameChange = await page.evaluate(async ({ storeId, suffix }) => {
    const response = await fetch("/api/store", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      storeId, name: `ALN Display ${suffix}`, description: "", contactEmail: `url-owner-${suffix}@e2e.todijo.test`, phone: "", logo: "", banner: "", country: "FR", city: "Lille", currency: "EUR", language: "fr", sellerType: "PRIVATE",
      legalBusinessName: "", businessRegistrationId: "", businessAddress: "", businessPostalCode: "", vatNumber: "", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE", displayBusinessAddress: false, samePersonalBusinessAddress: false,
      shippingEnabled: false, shippingMethodName: "", shippingPrice: "", shippingFree: false, shippingFreeThreshold: "", shippingMinDays: null, shippingMaxDays: null, shippingCountries: [], shippingWorldwide: false, shippingPostalCodes: [], shippingCarrier: "",
    }) });
    return { status: response.status, body: await response.json() };
  }, { storeId: publicStoreId, suffix });
  expect(displayNameChange).toMatchObject({ status: 200, body: { store: { slug: originalSlug } } });
  expect((await db.store.findUniqueOrThrow({ where: { id: publicStoreId }, select: { name: true, slug: true } })).slug).toBe(originalSlug);
  await page.reload();
  await expect(page.locator(".storeUrlSettings")).toContainText(`ALN Display ${suffix}`);
  const reserved = await page.evaluate(async ({ storeId }) => {
    const response = await fetch("/api/store/slug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, slug: "admin" }) });
    return { status: response.status, body: await response.json() };
  }, { storeId: publicStoreId });
  expect(reserved, `reserved slug response: ${JSON.stringify(reserved)}`).toMatchObject({ status: 400, body: { error: "RESERVED_SLUG" } });
  const duplicate = await page.evaluate(async ({ storeId, slug }) => {
    const response = await fetch("/api/store/slug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, slug }) });
    return { status: response.status, body: await response.json() };
  }, { storeId: publicStoreId, slug: `platform-cj-${suffix}` });
  expect(duplicate).toMatchObject({ status: 409, body: { error: "SLUG_TAKEN" } });
  await page.locator(`#store-url-slug-${publicStoreId}`).fill(firstSlug);
  await page.getByRole("button", { name: "Demander un changement d’URL" }).click();
  await expect(page.getByText(`/fr/store/${firstSlug}`)).toBeVisible();
  await page.getByRole("button", { name: "Confirmer le changement d’URL" }).click();
  await expect(page.getByRole("status").filter({ hasText: "L’URL de la boutique a été mise à jour." })).toBeVisible();
  await expect(page.locator(".storeUrlSettings a")).toHaveAttribute("href", `/fr/store/${firstSlug}`);

  const oldSlugState = await db.store.findUniqueOrThrow({ where: { id: publicStoreId }, select: { slug: true } });
  const originalAlias = await db.storeSlugHistory.findUnique({ where: { slug: originalSlug }, select: { storeId: true } });
  expect(oldSlugState.slug).toBe(firstSlug);
  expect(originalAlias?.storeId).toBe(publicStoreId);
  // Server Component redirects can be streamed as a client-side redirect (HTTP
  // 200) under the root loading boundary. Validate the actual browser journey,
  // not a non-browser request's status code.
  await page.goto(`/fr/store/${originalSlug}?page=1&sort=newest`);
  await expect(page).toHaveURL(`/fr/store/${firstSlug}?page=1&sort=newest`);
  await page.goto(`/fr/seller/store-settings?store=${encodeURIComponent(publicStoreId)}`);

  const racingContext = await page.context().browser()!.newContext();
  const racingPage = await racingContext.newPage();
  await authenticate(racingPage, ownerId, "SELLER");
  await racingPage.goto(`/fr/seller/store-settings?store=${encodeURIComponent(publicStoreId)}`);
  const racingResults = await Promise.all([secondSlug, thirdSlug].map(slug => racingPage.evaluate(async ({ storeId, slug }) => {
    const response = await fetch("/api/store/slug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, slug }) });
    return { status: response.status, body: await response.json() };
  }, { storeId: publicStoreId, slug })));
  expect(racingResults.filter(result => result.status === 200)).toHaveLength(1);
  expect(racingResults.filter(result => result.status === 409 && result.body.error === "SLUG_CHANGE_COOLDOWN")).toHaveLength(1);
  await racingContext.close();
  const racingCanonical = (await db.store.findUniqueOrThrow({ where: { id: publicStoreId }, select: { slug: true } })).slug;
  expect([secondSlug, thirdSlug]).toContain(racingCanonical);

  const sameSlug = await page.evaluate(async ({ storeId, slug }) => {
    const response = await fetch("/api/store/slug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, slug }) });
    return { status: response.status, body: await response.json() };
  }, { storeId: publicStoreId, slug: racingCanonical });
  expect(sameSlug).toMatchObject({ status: 200, body: { changed: false, slug: racingCanonical } });

  const cooldown = await page.evaluate(async ({ storeId, slug }) => {
    const response = await fetch("/api/store/slug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, slug }) });
    return { status: response.status, body: await response.json() };
  }, { storeId: publicStoreId, slug: finalSlug });
  expect(cooldown.status).toBe(409);
  expect(cooldown.body.error).toBe("SLUG_CHANGE_COOLDOWN");
  expect(cooldown.body.nextEligibleAt).toBeTruthy();

  await db.store.update({ where: { id: publicStoreId }, data: { slugLastChangedAt: new Date(Date.now() - 15 * 86_400_000) } });
  await page.reload();
  await page.locator(`#store-url-slug-${publicStoreId}`).fill(finalSlug);
  await page.getByRole("button", { name: "Demander un changement d’URL" }).click();
  await page.getByRole("button", { name: "Confirmer le changement d’URL" }).click();
  await expect(page.getByRole("status").filter({ hasText: "L’URL de la boutique a été mise à jour." })).toBeVisible();
  await page.goto(`/fr/store/${originalSlug}`);
  await expect(page).toHaveURL(`/fr/store/${finalSlug}`);

  const oldProduct = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { storeId: true, name: true } });
  expect(oldProduct).toEqual({ storeId: publicStoreId, name: "URL lifecycle fixture" });
  const identity = await db.store.findUniqueOrThrow({ where: { id: publicStoreId }, select: { id: true, ownerId: true, businessId: true, slug: true } });
  expect(identity).toMatchObject({ id: publicStoreId, ownerId, businessId, slug: finalSlug });
  const aliases = await db.storeSlugHistory.findMany({ where: { storeId: publicStoreId }, select: { slug: true } });
  expect(new Set(aliases.map(alias => alias.slug))).toEqual(new Set([originalSlug, firstSlug, racingCanonical]));

  const subordinateRename = await page.evaluate(async ({ storeId, slug }) => {
    const response = await fetch("/api/store/slug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, slug }) });
    return { status: response.status, body: await response.json() };
  }, { storeId: subordinateStoreId, slug: renamedSubordinateSlug });
  expect(subordinateRename).toMatchObject({ status: 200, body: { changed: true, slug: renamedSubordinateSlug } });
  const stableBusinessPointers = await db.sellerBusiness.findUniqueOrThrow({ where: { id: businessId }, select: { primaryStoreId: true, billingStoreId: true } });
  expect(stableBusinessPointers).toEqual({ primaryStoreId: publicStoreId, billingStoreId: publicStoreId });
  const stableStores = await db.store.findMany({ where: { id: { in: [publicStoreId, subordinateStoreId] } }, orderBy: { id: "asc" }, select: { id: true, ownerId: true, businessId: true, slug: true } });
  expect(stableStores).toEqual([
    { id: publicStoreId, ownerId, businessId, slug: finalSlug },
    { id: subordinateStoreId, ownerId, businessId, slug: renamedSubordinateSlug },
  ].sort((a, b) => a.id.localeCompare(b.id)));

  const pendingPublic = await request.get(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100"}/fr/store/pending-url-${suffix}`, { maxRedirects: 0 });
  expect(pendingPublic.status()).toBe(404);
  const pendingLegacyPublic = await request.get(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100"}/fr/store/${pendingOldSlug}`, { maxRedirects: 0 });
  expect(pendingLegacyPublic.status()).toBe(404);
  const pendingContext = await page.context().browser()!.newContext();
  const pendingPage = await pendingContext.newPage();
  await authenticate(pendingPage, pendingOwnerId, "SELLER");
  await pendingPage.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100"}/fr/store/${pendingOldSlug}`);
  await expect(pendingPage).toHaveURL(new RegExp(`/fr/store/pending-url-${suffix}$`));
  await expect(pendingPage.locator(".storeOwnerPreviewCard")).toContainText("Cette boutique n’est pas encore visible publiquement");
  await expect(pendingPage.locator(".storeOwnerPreviewCard")).toContainText("En attente");
  await expect(pendingPage.locator(".storeOwnerPreviewCard a")).toHaveAttribute("href", `/fr/seller/onboarding`);
  await pendingContext.close();

  const platform = await db.store.findUniqueOrThrow({ where: { id: platformStoreId }, select: { ownerId: true, slug: true, name: true } });
  expect(platform).toEqual({ ownerId: adminId, slug: `platform-cj-${suffix}`, name: `Platform URL ${suffix}` });
  const platformProduct = await db.product.findUniqueOrThrow({ where: { id: platformProductId }, select: { storeId: true, name: true, status: true } });
  expect(platformProduct).toEqual({ storeId: platformStoreId, name: "Synthetic CJ platform product", status: "PUBLISHED" });

  const attackerContext = await page.context().browser()!.newContext();
  const attackerPage = await attackerContext.newPage();
  await authenticate(attackerPage, attackerId, "CUSTOMER");
  const unauthorized = await attackerPage.evaluate(async ({ storeId, slug }) => {
    const response = await fetch("/api/store/slug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, slug }) });
    return { status: response.status, body: await response.json() };
  }, { storeId: publicStoreId, slug: `intrusion-${suffix}` });
  expect(unauthorized.status).toBe(403);
  expect((await db.store.findUniqueOrThrow({ where: { id: publicStoreId }, select: { slug: true } })).slug).toBe(finalSlug);
  await attackerContext.close();
});
