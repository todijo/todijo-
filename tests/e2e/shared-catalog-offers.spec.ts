import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { CANONICAL_LEAF_CATEGORIES } from "../../lib/desktop-category-taxonomy";
import { createCheckout } from "../../lib/payments";
import { productPath } from "../../lib/product-seo";
import { catalogBrandModelKey } from "../../lib/shared-catalog-matching";
import { sharedCatalogMessages, sharedCatalogSearchMessages } from "../../i18n/shared-catalog";
import { sellerProductWizardCopy } from "../../i18n/seller-product-wizard";
import { dismissCookieConsent } from "./helpers";

const db = new PrismaClient();
const sessionSecret = "e2e-only-placeholder-secret-at-least-32-characters";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

async function sessionToken(userId: string) {
  return new SignJWT({ userId, role: "CUSTOMER", authVersion: 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(sessionSecret));
}

async function addSession(page: Page, userId: string) {
  const token = await sessionToken(userId);
  await page.context().addCookies([{ name: "todijo_session", value: token, url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
}

test("a seller offer stays distinct from its shared identity through PDP, cart, checkout, and persisted order", async ({ browser, request }) => {
  test.setTimeout(90_000);
  const databaseUrl = process.env.PLAYWRIGHT_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  const parsed = new URL(databaseUrl);
  if (process.env.TODIJO_CI_DISPOSABLE_DATABASE !== "1"
    || parsed.hostname !== "127.0.0.1"
    || parsed.username !== "validation"
    || parsed.pathname !== "/todijo_browser"
    || parsed.port !== (process.env.PGPORT ?? "5432")) {
    throw new Error("Refusing shared-catalog offer E2E against a non-disposable database.");
  }

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const now = new Date();
  const category = CANONICAL_LEAF_CATEGORIES[0].id;
  const title = `Premium shared catalog item ${suffix}`;
  const description = "A shared catalog item used by the isolated seller offer integration test.";
  const sharedCatalogProductId = `shared-catalog-${suffix}`;
  const buyerId = `shared-buyer-${suffix}`;
  const sellerAId = `shared-seller-a-${suffix}`;
  const sellerBId = `shared-seller-b-${suffix}`;
  const businessAId = `shared-business-a-${suffix}`;
  const businessBId = `shared-business-b-${suffix}`;
  const storeAId = `shared-store-a-${suffix}`;
  const storeBId = `shared-store-b-${suffix}`;
  const productAId = `shared-offer-a-${suffix}`;
  const storeAName = `Shared Catalog Seller A ${suffix}`;
  const storeBName = `Shared Catalog Seller B ${suffix}`;
  const accountAId = `acct_shared_a_${suffix}`;
  const accountBId = `acct_shared_b_${suffix}`;

  await db.user.createMany({ data: [
    { id: buyerId, firstName: "Shared", lastName: "Buyer", email: `shared-buyer-${suffix}@e2e.todijo.test`, role: "CUSTOMER", emailVerified: true, authVersion: 0 },
    { id: sellerAId, firstName: "Seller", lastName: "A", email: `shared-seller-a-${suffix}@e2e.todijo.test`, role: "SELLER", emailVerified: true, authVersion: 0, stripeAccountId: accountAId, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true },
    { id: sellerBId, firstName: "Seller", lastName: "B", email: `shared-seller-b-${suffix}@e2e.todijo.test`, role: "SELLER", emailVerified: true, authVersion: 0, stripeAccountId: accountBId, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true },
  ] });
  await db.buyerShippingAddress.create({ data: { userId: buyerId, recipientName: "Shared Buyer", addressLine1: "1 Rue de Test", postalCode: "75001", city: "Paris", country: "FR", isDefault: true } });
  await db.sellerBusiness.createMany({ data: [
    { id: businessAId, ownerId: sellerAId, maxStores: 1 },
    { id: businessBId, ownerId: sellerBId, maxStores: 1 },
  ] });
  const storeFields = {
    country: "FR",
    city: "Paris",
    currency: "EUR",
    language: "en",
    status: "ACTIVE" as const,
    dataClass: "PRODUCTION" as const,
    sellerType: "PRIVATE" as const,
    vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE" as const,
    onboardingStatus: "VERIFIED" as const,
    shippingEnabled: true,
    shippingMethodName: "Standard delivery",
    shippingFree: true,
    shippingWorldwide: true,
    shippingMinDays: 2,
    shippingMaxDays: 5,
    marketplaceActivatedAt: now,
  };
  await db.store.createMany({ data: [
    { ...storeFields, id: storeAId, name: storeAName, slug: `shared-catalog-a-${suffix}`, contactEmail: `shared-seller-a-${suffix}@e2e.todijo.test`, ownerId: sellerAId, businessId: businessAId },
    { ...storeFields, id: storeBId, name: storeBName, slug: `shared-catalog-b-${suffix}`, contactEmail: `shared-seller-b-${suffix}@e2e.todijo.test`, ownerId: sellerBId, businessId: businessBId },
  ] });
  await db.sellerSubscription.createMany({ data: [
    { storeId: storeAId, stripePriceId: "price_e2e_pro_a", plan: "pro", status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
    { storeId: storeBId, stripePriceId: "price_e2e_pro_b", plan: "pro", status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
  ] });
  await db.sellerBusiness.update({ where: { id: businessAId }, data: { primaryStoreId: storeAId, billingStoreId: storeAId } });
  await db.sellerBusiness.update({ where: { id: businessBId }, data: { primaryStoreId: storeBId, billingStoreId: storeBId } });
  await db.user.update({ where: { id: sellerAId }, data: { primaryStoreId: storeAId } });
  await db.user.update({ where: { id: sellerBId }, data: { primaryStoreId: storeBId } });
  const brand = "Verified shared brand";
  const modelReference = `model-${suffix}`;
  await db.sharedCatalogProduct.create({ data: { id: sharedCatalogProductId, title, brand, modelReference, brandModelKey: catalogBrandModelKey(brand, modelReference), description, category, sourceLocale: "en", status: "PUBLISHED" } });
  await db.product.create({ data: {
    id: productAId,
    storeId: storeAId,
    sharedCatalogProductId,
    name: title,
    slug: `shared-offer-a-${suffix}`,
    description,
    price: "19.90",
    currency: "EUR",
    category,
    condition: "NEUF",
    stock: 4,
    images: [],
    status: "PUBLISHED",
    dataClass: "PRODUCTION",
    complianceDeclaredAt: now,
  } });
  await db.product.create({ data: {
    id: `legacy-product-${suffix}`,
    storeId: storeAId,
    name: `Legacy ${title}`,
    slug: `legacy-shared-search-${suffix}`,
    description,
    price: "18.00",
    currency: "EUR",
    category,
    condition: "NEUF",
    stock: 2,
    images: [],
    status: "PUBLISHED",
    dataClass: "PRODUCTION",
    complianceDeclaredAt: now,
  } });

  const sellerToken = await sessionToken(sellerBId);
  const titleOnlyOffer = await request.post(`${baseUrl}/api/products`, { headers: { Cookie: `todijo_session=${sellerToken}` }, data: { storeId: storeBId, sharedCatalogProductId, sharedCatalogExactMatchConfirmed: true } });
  expect(titleOnlyOffer.status()).toBe(400);
  expect(await titleOnlyOffer.json()).toMatchObject({ error: "SHARED_CATALOG_IDENTITY_REQUIRED" });
  const titleSearch = await request.get(`${baseUrl}/api/shared-catalog/matches?store=${storeBId}&title=${encodeURIComponent(title)}`, { headers: { Cookie: `todijo_session=${sellerToken}` } });
  expect(titleSearch.status()).toBe(200);
  const titleSearchBody = await titleSearch.json() as { products: Array<{ id: string; source: string; exactIdentity: boolean }> };
  expect(titleSearchBody.products).toContainEqual(expect.objectContaining({ id: sharedCatalogProductId, source: "SHARED", exactIdentity: false }));
  const identitySearch = await request.get(`${baseUrl}/api/shared-catalog/matches?store=${storeBId}&brand=${encodeURIComponent(brand)}&modelReference=${encodeURIComponent(modelReference)}`, { headers: { Cookie: `todijo_session=${sellerToken}` } });
  expect(identitySearch.status()).toBe(200);
  const identitySearchBody = await identitySearch.json() as { products: Array<{ id: string; source: string; exactIdentity: boolean }> };
  expect(identitySearchBody.products).toContainEqual(expect.objectContaining({ id: sharedCatalogProductId, source: "SHARED", exactIdentity: true }));

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await addSession(sellerPage, sellerBId);
  await sellerPage.goto(`/en/seller/products/new?store=${storeBId}`);
  await dismissCookieConsent(sellerPage);
  const sellerCopy = sharedCatalogSearchMessages.en;
  const wizardCopy = sellerProductWizardCopy("en");
  await expect(sellerPage.getByText(sharedCatalogMessages.en.noResults)).toHaveCount(0);
  await expect(sellerPage.getByText(sellerCopy.newProductHelp)).toBeVisible();
  await expect(sellerPage.getByText(sellerCopy.exactMatch)).toHaveCount(0);
  let failFirstSearch = true;
  await sellerPage.route("**/api/shared-catalog/matches?*", async (route) => {
    if (failFirstSearch) {
      failFirstSearch = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "TEMPORARILY_UNAVAILABLE" }) });
      return;
    }
    await route.continue();
  });
  await sellerPage.getByLabel(sharedCatalogMessages.en.productTitle, { exact: true }).fill(title);
  await sellerPage.getByRole("button", { name: "Search catalog", exact: true }).click();
  await expect(sellerPage.getByText(sellerCopy.searchError)).toBeVisible();
  await expect(sellerPage.getByText(sharedCatalogMessages.en.noResults)).toHaveCount(0);
  await sellerPage.getByRole("button", { name: sellerCopy.retry, exact: true }).click();
  const suggestionCard = sellerPage.locator(".sharedCatalogCandidates article").filter({ has: sellerPage.getByRole("heading", { name: title, exact: true }) });
  await expect(suggestionCard.getByText(sellerCopy.suggestion)).toBeVisible();
  await expect(suggestionCard.getByRole("button")).toHaveCount(0);
  const legacyCard = sellerPage.locator(".sharedCatalogCandidates article").filter({ has: sellerPage.getByRole("heading", { name: `Legacy ${title}`, exact: true }) });
  await expect(legacyCard.getByText(sellerCopy.legacyReview)).toBeVisible();
  await expect(legacyCard.getByRole("button")).toHaveCount(0);
  await sellerPage.getByLabel("Brand", { exact: true }).fill(brand);
  await sellerPage.getByLabel("Model reference", { exact: true }).fill(modelReference);
  await sellerPage.getByRole("button", { name: "Search catalog", exact: true }).click();
  const exactCard = sellerPage.locator(".sharedCatalogCandidates article").filter({ has: sellerPage.getByRole("heading", { name: title, exact: true }) });
  await expect(exactCard.getByText(sellerCopy.exactMatch)).toBeVisible();
  await exactCard.getByRole("button", { name: "Sell this product", exact: true }).click();
  await sellerPage.getByRole("checkbox", { name: title, exact: true }).check();
  await sellerPage.locator(".sharedCatalogConfirmation").getByRole("button", { name: "Sell this product", exact: true }).click();
  await expect(sellerPage.locator("#category-main")).toBeVisible();
  await sellerPage.getByRole("button", { name: wizardCopy.back, exact: true }).click();
  await expect(sellerPage.getByLabel(sharedCatalogMessages.en.productTitle, { exact: true })).toHaveValue(title);
  await sellerPage.getByRole("button", { name: sharedCatalogMessages.en.newProduct, exact: true }).click();
  await expect(sellerPage.locator("#name")).toHaveValue(title);
  await expect(sellerPage.locator('input[name="manufacturerName"]')).toHaveValue(brand);
  await sellerPage.locator("#category-main").selectOption({ index: 1 });
  await sellerPage.locator("#category-group").selectOption({ index: 1 });
  await sellerPage.locator("#category").selectOption({ index: 1 });
  await sellerPage.getByRole("button", { name: wizardCopy.continue, exact: true }).click();
  await expect(sellerPage.locator('[data-wizard-step="1"]')).toBeVisible();
  await expect(sellerPage.locator("#description")).toBeVisible();
  await sellerPage.locator("#description").fill("Seller-entered draft details that must survive returning to catalog search.");
  await sellerPage.locator(".sellerProductWizard > button.sellerControlButton.secondary").click();
  await sellerPage.getByRole("button", { name: sharedCatalogMessages.en.newProduct, exact: true }).click();
  await expect(sellerPage.locator("#description")).toHaveValue("Seller-entered draft details that must survive returning to catalog search.");
  await sellerContext.close();

  const sellerOfferResponse = await request.post(`${baseUrl}/api/products`, { headers: { Cookie: `todijo_session=${sellerToken}` }, data: {
    storeId: storeBId,
    sharedCatalogProductId,
    sharedCatalogExactMatchConfirmed: true,
    sharedCatalogIdentity: { brand, modelReference },
    name: title,
    description,
    category,
    condition: "NEUF",
    status: "PUBLISHED",
    price: "24.50",
    stock: 7,
    images: [],
    complianceDeclaration: true,
  } });
  const sellerOfferBody = await sellerOfferResponse.json() as { product?: { id: string; status: string; sharedCatalogProductId: string | null }; error?: string; code?: string };
  expect(sellerOfferResponse.status(), JSON.stringify(sellerOfferBody)).toBe(200);
  const productBId = sellerOfferBody.product!.id;
  const persistedOffer = await db.product.findUnique({ where: { id: productBId }, select: { id: true, status: true, storeId: true, sharedCatalogProductId: true } });
  expect(persistedOffer).toMatchObject({ status: "PUBLISHED", storeId: storeBId, sharedCatalogProductId });
  const searchResponse = await request.get(`${baseUrl}/api/marketplace/products?q=${encodeURIComponent(title)}`);
  const searchBody = await searchResponse.json() as { products: Array<{ id: string; name: string; sharedCatalogProductId: string | null }> };
  expect(searchResponse.status()).toBe(200);
  const sharedSearchResults = searchBody.products.filter((product) => product.sharedCatalogProductId === sharedCatalogProductId);
  expect(sharedSearchResults).toHaveLength(1);
  expect(sharedSearchResults[0]).toMatchObject({ name: title });

  const buyerContext = await browser.newContext();
  const page = await buyerContext.newPage();
  await addSession(page, buyerId);
  await page.goto(`/en/store/shared-catalog-b-${suffix}`);
  await dismissCookieConsent(page);
  await expect(page.getByRole("link", { name: title, exact: true }).first()).toHaveAttribute("href", productPath("en", productBId, title));
  await page.goto(productPath("en", productAId, title));
  const sellerBOffer = page.locator(".sharedCatalogOffers article").filter({ hasText: storeBName });
  await expect(sellerBOffer).toContainText("24.50");
  await sellerBOffer.getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/en/product/${productBId}/`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.locator(".productSellerInformationCard")).toContainText(storeBName);
  const addToCart = page.locator(".productPurchaseCard .addCartButton").first();
  await expect(addToCart).toBeEnabled();
  await addToCart.click();
  await page.goto("/en/cart");
  await expect(page.getByText(title).first()).toBeVisible();
  const cart = await page.evaluate((authenticatedBuyerId) => JSON.parse(localStorage.getItem(`todijo-cart-v1:${authenticatedBuyerId}`) ?? "[]") as Array<{ id: string; storeSlug: string; quantity: number }>, buyerId);
  expect(cart).toEqual([expect.objectContaining({ id: productBId, storeSlug: `shared-catalog-b-${suffix}`, quantity: 1 })]);

  await page.goto("/en/checkout");
  await expect(page.locator(".shippingAddressCard")).toContainText("1 Rue de Test");
  await expect(page.locator(".shippingQuoteCard")).toBeVisible();
  const checkoutCapture: { payload?: { requestId: string; items: Array<{ productId: string; quantity: number }> }; orderId?: string } = {};
  await page.route("**/api/checkout", async (route) => {
    checkoutCapture.payload = route.request().postDataJSON() as { requestId: string; items: Array<{ productId: string; quantity: number }> };
    const result = await createCheckout(
      db,
      buyerId,
      checkoutCapture.payload.requestId,
      checkoutCapture.payload.items,
      async () => ({ id: `cs_test_shared_${suffix}`, url: `https://checkout.test.invalid/${suffix}` }),
      "FR",
      undefined,
      {
        buyerCurrency: "EUR",
        commercialEntitlement: async (_client, businessId) => ({ businessId, primaryStoreId: storeBId, billingStoreId: storeBId, active: true, plan: "pro", source: "STRIPE", expiresAt: new Date(Date.now() + 30 * 86_400_000) }),
        retrieveConnectedAccount: async (accountId) => ({ id: accountId, object: "account", details_submitted: true, charges_enabled: true, payouts_enabled: true }),
      },
    );
    checkoutCapture.orderId = result.orderId;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...result, url: "/en/e2e-ux?view=buyer-path" }) });
  });
  await expect(page.locator(".checkoutForm button.authSubmit")).toBeEnabled();
  await page.locator(".checkoutForm button.authSubmit").click();
  await expect(page).toHaveURL(/\/en\/e2e-ux\?view=buyer-path$/);
  expect(checkoutCapture.payload?.items).toEqual([expect.objectContaining({ productId: productBId, quantity: 1 })]);
  const persistedOrder = await db.order.findUnique({ where: { id: checkoutCapture.orderId! }, include: { items: true } });
  expect(persistedOrder).toMatchObject({ status: "PENDING", storeIdSnapshot: storeBId });
  expect(persistedOrder?.items).toHaveLength(1);
  expect(persistedOrder?.items[0]).toMatchObject({ productId: productBId, productNameSnapshot: title, quantity: 1 });
  await buyerContext.close();
});

test.afterAll(async () => {
  await db.$disconnect();
});
