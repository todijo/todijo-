import { expect, test } from "@playwright/test";
import { collectRuntimeErrors, dismissCookieConsent } from "./helpers";
import { SignJWT } from "jose";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { DESKTOP_CATEGORY_TAXONOMY } from "../../lib/desktop-category-taxonomy";
import { categoryNavigationMessages } from "../../i18n/category-navigation";

const e2eSecret = "e2e-only-placeholder-secret-at-least-32-characters";
const databaseUsers = [
  { id: "header-buyer", firstName: "Header", lastName: "Buyer", email: "header-buyer@e2e.todijo.test" },
  { id: "buyer-a", firstName: "Buyer", lastName: "A", email: "buyer-a@e2e.todijo.test" },
  { id: "buyer-b", firstName: "Buyer", lastName: "B", email: "buyer-b@e2e.todijo.test" },
] as const;

function executeFixtureSql(sql: string) {
  execFileSync(process.execPath, [join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "db", "execute", "--schema", join(process.cwd(), "prisma", "schema.prisma"), "--stdin"], { input: sql, env: process.env, stdio: ["pipe", "ignore", "pipe"] });
}

test.beforeAll(async () => {
  executeFixtureSql(`INSERT INTO "User" ("id","firstName","lastName","email","role","authVersion","createdAt","updatedAt") VALUES
    ('header-buyer','Header','Buyer','header-buyer@e2e.todijo.test','CUSTOMER',0,NOW(),NOW()),
    ('buyer-a','Buyer','A','buyer-a@e2e.todijo.test','CUSTOMER',0,NOW(),NOW()),
    ('buyer-b','Buyer','B','buyer-b@e2e.todijo.test','CUSTOMER',0,NOW(),NOW())
    ON CONFLICT ("id") DO UPDATE SET "role"='CUSTOMER', "authVersion"=0, "updatedAt"=NOW();`);
});

test.afterAll(async () => {
  executeFixtureSql(`DELETE FROM "User" WHERE "id" IN (${databaseUsers.map((user) => `'${user.id}'`).join(",")});`);
});

async function authenticate(page: import("@playwright/test").Page, userId: string) {
  const token = await new SignJWT({ userId, role: "CUSTOMER", authVersion: 0 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(e2eSecret));
  await page.context().addCookies([{ name: "todijo_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
}

test("English authentication entry renders the application shell", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);

  const response = await page.goto("/en/login");

  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  assertNoRuntimeErrors();
});

test("localized route renders with its requested locale", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);

  const response = await page.goto("/fr/login");

  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/fr\/login$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("main")).toBeVisible();
  assertNoRuntimeErrors();
});

test("authentication navigation preserves the active locale", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);
  await page.goto("/en/login");

  await page.getByRole("link", { name: "Forgot password?" }).click();

  await expect(page).toHaveURL(/\/en\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "Forgot your password?" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  assertNoRuntimeErrors();
});

test("public marketplace information page renders without live services", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);

  const response = await page.goto("/en/info/about");

  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/en\/info\/about$/);
  await expect(page.getByRole("heading", { name: "About Todijo" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Todijo" }).first()).toBeVisible();
  assertNoRuntimeErrors();
});

test("Phase 5 legal pages show truthful protection copy and remain contained in RTL and mobile", async ({ page }) => {
  const response = await page.goto("/en/info/returns");
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "How buyer protection works" })).toBeVisible();
  await expect(page.getByText(/final approval or rejection with an authorised Todijo administrator/i)).toBeVisible();
  await expect(page.getByText(/not escrow/i)).toBeVisible();
  await expect(page.getByText(/Todijo does not receive full card details/i)).toHaveCount(0);
  const footerReturns = page.locator(".marketplaceFooterMain a[href='/en/info/returns']");
  await expect(footerReturns).toHaveCount(1);

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/ar/info/returns");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "كيفية عمل حماية المشتري" })).toBeVisible();
  const overflow = await page.locator("main").evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("unauthenticated visitors are redirected away from the dashboard", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);

  await page.goto("/en/dashboard");

  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  assertNoRuntimeErrors();
});

test("unknown public routes render the localized not-found page", async ({ page }) => {
  const assertNoRuntimeErrors = collectRuntimeErrors(page);

  await page.goto("/en/this-route-does-not-exist");

  await expect(page).toHaveURL(/\/en\/this-route-does-not-exist$/);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link").first()).toBeVisible();
  assertNoRuntimeErrors();
});

test("canonical filter dock opens facets, preserves selection, and updates the URL", async ({ page }) => {
  await page.route(/\/en\/search\?/, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Search</title>" }));
  await page.goto("/en/e2e-ux");
  await dismissCookieConsent(page);
  let dock = page.getByRole("region", { name: "Filters" });
  await expect(dock).toBeVisible();
  const countryFacet = dock.locator("details:has(.countryFacetPopover)");
  await countryFacet.locator("summary").click();
  const [countryRequest] = await Promise.all([
    page.waitForRequest((request) => new URL(request.url()).pathname === "/en/search"),
    page.waitForURL(/\/en\/search\?country=FR/),
    countryFacet.getByRole("button", { name: "France" }).click({ noWaitAfter: true }),
  ]);
  expect(new URL(countryRequest.url()).searchParams.get("country")).toBe("FR");

  await page.goto("/en/e2e-ux");
  dock = page.getByRole("region", { name: "Filters" });
  const ratingFacet = dock.locator('details:has(input[name="rating-dock"])');
  await ratingFacet.locator("summary").click();
  await expect(ratingFacet.locator(".marketFacetPopover")).toBeVisible();
  const [ratingRequest] = await Promise.all([
    page.waitForRequest((request) => new URL(request.url()).pathname === "/en/search"),
    page.waitForURL(/\/en\/search\?rating=4/),
    ratingFacet.locator("label").nth(1).click({ noWaitAfter: true }),
  ]);
  expect(new URL(ratingRequest.url()).searchParams.get("rating")).toBe("4");

  await page.goto("/en/e2e-ux");
  dock = page.getByRole("region", { name: "Filters" });
  await page.getByLabel("Minimum price").fill("10");
  await dock.getByRole("button", { name: "In stock" }).click();
  await expect(dock.getByRole("button", { name: "In stock" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Minimum price")).toHaveValue("10");
  const [searchRequest] = await Promise.all([
    page.waitForRequest((request) => new URL(request.url()).pathname === "/en/search"),
    dock.getByRole("button", { name: "Apply filters" }).click({ noWaitAfter: true }),
  ]);
  const searchUrl = new URL(searchRequest.url());
  expect(searchUrl.searchParams.get("minPrice")).toBe("10");
  expect(searchUrl.searchParams.get("availability")).toBe("in-stock");
});

test("homepage presents the localized stores CTA to the public directory", async ({ page }) => {
  await page.goto("/en/e2e-ux?view=home");
  const storesCta = page.getByRole("link", { name: "Stores to discover" }).last();
  await expect(storesCta).toBeVisible();
  await expect(storesCta).toHaveAttribute("href", "/en/store");
});

test("marketplace routes render one shared header with core navigation", async ({ page }) => {
  await authenticate(page, "header-buyer");
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { authenticated: true, userId: "header-buyer", name: "Header Buyer" } }));
  await page.goto("/en/e2e-ux");
  const homeHeader = page.locator("header[data-marketplace-header]");
  await expect(homeHeader).toBeVisible();
  await expect(homeHeader.getByRole("link", { name: "Todijo" })).toBeVisible();
  await expect(homeHeader.getByRole("link", { name: "Messages" })).toBeVisible();
  await expect(homeHeader.getByRole("link", { name: "My favorites" })).toBeVisible();
  await expect(homeHeader.getByRole("link", { name: "Cart" })).toBeVisible();
  await expect(homeHeader.getByRole("combobox")).toBeVisible();

  await page.goto("/en/cart");
  await expect(page.locator("header[data-marketplace-header]")).toBeVisible();
  await page.goto("/en/favorites");
  await expect(page.locator("header[data-marketplace-header]")).toBeVisible();
});

test("desktop category rail opens its canonical menu and preserves localized routing", async ({ page }) => {
  const locale = "en";
  const localizedCategories = categoryNavigationMessages[locale];
  const localizedCategoryLabel = (id: string) => {
    if (!(id in localizedCategories)) throw new Error(`Missing localized category label: ${id}`);
    return localizedCategories[id as keyof typeof localizedCategories];
  };
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { authenticated: false } }));
  await page.route(/\/en\/search\?/, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Search</title>" }));
  await page.goto("/en/e2e-ux?view=home");
  await dismissCookieConsent(page);
  const rail = page.getByRole("navigation", { name: "Categories" });
  await expect(rail).toBeVisible();
  const parentControls = rail.locator("button.marketQuickCategory:not(.marketQuickMore)");
  await expect(parentControls).toHaveCount(DESKTOP_CATEGORY_TAXONOMY.length);
  for (const canonicalCategory of DESKTOP_CATEGORY_TAXONOMY) {
    await expect(rail.getByRole("button", { name: localizedCategoryLabel(canonicalCategory.id), exact: true })).toBeVisible();
  }
  const firstCategory = DESKTOP_CATEGORY_TAXONOMY[0];
  const firstVisibleLabel = localizedCategoryLabel(firstCategory.id);
  const category = rail.getByRole("button", { name: firstVisibleLabel, exact: true });
  await category.hover();
  await expect(page.locator("#market-category-mega-menu")).toHaveCount(0);
  await expect(category).toHaveAttribute("aria-expanded", "false");
  await category.click();
  const menu = page.getByRole("region", { name: firstVisibleLabel });
  await expect(menu).toBeVisible();
  await expect(category).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("link", { name: "View all", exact: true })).toHaveAttribute("href", `/en/search?category=${encodeURIComponent(firstCategory.label)}`);
  const secondCategory = DESKTOP_CATEGORY_TAXONOMY[1];
  const secondVisibleLabel = localizedCategoryLabel(secondCategory.id);
  await menu.getByRole("button", { name: secondVisibleLabel, exact: true }).click();
  const secondMenu = page.getByRole("region", { name: secondVisibleLabel });
  await expect(secondMenu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#market-category-mega-menu")).toHaveCount(0);
  await category.click();
  await page.locator(".discoveryHero").click({ position: { x: 10, y: 10 } });
  await expect(page.locator("#market-category-mega-menu")).toHaveCount(0);
  const secondParent = rail.getByRole("button", { name: secondVisibleLabel, exact: true });
  await secondParent.click();
  const reopenedSecondMenu = page.getByRole("region", { name: secondVisibleLabel });
  const canonicalChildCategory = secondCategory.groups[0].items[0];
  const child = reopenedSecondMenu.getByRole("link", { name: canonicalChildCategory, exact: true });
  await expect(child).toHaveAttribute("href", `/en/search?category=${encodeURIComponent(canonicalChildCategory)}`);
  await Promise.all([page.waitForURL(/\/en\/search\?category=/), child.click()]);
  const navigated = new URL(page.url());
  expect(navigated.pathname).toBe(`/${locale}/search`);
  expect(navigated.searchParams.get("category")).toBe(canonicalChildCategory);
  await page.goto("/en/e2e-ux?view=home");
  await expect(page.locator(".categoryStripSection")).toBeHidden();
  await expect(page.locator(".categoryShowcase")).toBeHidden();
  const more = page.getByRole("button", { name: "Categories", exact: true });
  await more.focus();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "false");
});

test("favorites require a database-backed session and reject a JWT-only identity", async ({ page }) => {
  await page.goto("/en/favorites");
  await expect(page).toHaveURL(/\/en\/login\?next=\/en\/favorites$/);

  await authenticate(page, "jwt-only-user-not-in-database");
  await page.goto("/en/favorites");
  await expect(page).toHaveURL(/\/en\/login\?next=\/en\/favorites$/);

  await authenticate(page, "buyer-a");
  await page.goto("/en/favorites");
  await expect(page).toHaveURL(/\/en\/favorites$/);
  await expect(page.locator("header[data-marketplace-header]")).toBeVisible();
});

test("favorites remain isolated across logout and two authenticated buyers", async ({ page }) => {
  const products = [
    { id: "e2e-product-x", name: "Buyer A favorite", price: "29.99", compareAtPrice: null, currency: "EUR", category: "electronics", stock: 4, hasActiveVariants: false, isGenerallyAvailable: true, condition: "NEUF", image: null, storeName: "Todijo Test Store", storeSlug: "todijo-test" },
    { id: "e2e-product-y", name: "Buyer B favorite", price: "39.99", compareAtPrice: null, currency: "EUR", category: "electronics", stock: 4, hasActiveVariants: false, isGenerallyAvailable: true, condition: "NEUF", image: null, storeName: "Todijo Test Store", storeSlug: "todijo-test" },
  ];
  let currentUser: { id: string; name: string } | null = { id: "buyer-a", name: "Buyer A" };
  await page.route("**/api/auth/session", (route) => route.fulfill({
    json: currentUser ? { authenticated: true, userId: currentUser.id, name: currentUser.name } : { authenticated: false },
  }));
  await page.route("**/api/products?ids=**", (route) => {
    const ids = new URL(route.request().url()).searchParams.get("ids")?.split(",") ?? [];
    return route.fulfill({ json: { products: products.filter((product) => ids.includes(product.id)) } });
  });

  await authenticate(page, currentUser.id);
  await page.goto("/en/e2e-ux");
  await page.getByRole("article").filter({ hasText: products[0].name }).getByRole("button", { name: "Add to favorites" }).click();
  await page.getByRole("link", { name: "My favorites" }).click();
  await expect(page.getByRole("heading", { name: products[0].name })).toBeVisible();
  await expect(page.getByRole("heading", { name: products[1].name })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: products[0].name })).toBeVisible();

  currentUser = null;
  await page.context().clearCookies();
  await page.goto("/en/e2e-ux");
  await expect(page.getByRole("button", { name: "Add to favorites" })).toHaveCount(2);

  currentUser = { id: "buyer-b", name: "Buyer B" };
  await authenticate(page, currentUser.id);
  await page.goto("/en/e2e-ux");
  await expect(page.getByRole("button", { name: "Add to favorites" })).toHaveCount(2);
  await page.getByRole("article").filter({ hasText: products[1].name }).getByRole("button", { name: "Add to favorites" }).click();
  await page.getByRole("link", { name: "My favorites" }).click();
  await expect(page.getByRole("heading", { name: products[1].name })).toBeVisible();
  await expect(page.getByRole("heading", { name: products[0].name })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: products[1].name })).toBeVisible();

  currentUser = null;
  await page.context().clearCookies();
  await page.goto("/en/e2e-ux");
  currentUser = { id: "buyer-a", name: "Buyer A" };
  await authenticate(page, currentUser.id);
  await page.goto("/en/favorites");
  await expect(page.getByRole("heading", { name: products[0].name })).toBeVisible();
  await expect(page.getByRole("heading", { name: products[1].name })).toHaveCount(0);
  await page.getByRole("button", { name: "Remove from favorites" }).click();
  await expect(page.getByText("You don’t have any favorites yet.")).toBeVisible();

  currentUser = null;
  await page.context().clearCookies();
  await page.goto("/en/e2e-ux");
  currentUser = { id: "buyer-b", name: "Buyer B" };
  await authenticate(page, currentUser.id);
  await page.goto("/en/favorites");
  await expect(page.getByRole("heading", { name: products[1].name })).toBeVisible();
});

test("pre-purchase setting copy and checkbox render with the existing field", async ({ page }) => {
  await page.goto("/en/e2e-ux?view=seller");
  const checkbox = page.getByRole("checkbox", { name: /Allow questions before purchase/ });
  await expect(checkbox).toBeChecked();
  await expect(page.getByText("Buyers can contact you about this product before purchasing it.", { exact: false })).toBeVisible();
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toHaveAttribute("name", "allowPrepurchaseQuestions");
});

test("cart checkout and Stripe refresh controls keep readable state palettes", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { authenticated: false } }));
  await page.addInitScript(() => localStorage.setItem("todijo-cart-v1", JSON.stringify([{ id: "cart-product", name: "Cart product", price: 19, currency: "EUR", stock: 2, quantity: 1, lineKey: "cart-product::::" }])));
  await page.goto("/en/cart");
  const checkout = page.getByRole("link", { name: "Proceed to checkout" });
  const checkoutColors = await checkout.evaluate((element) => { const style = getComputedStyle(element); return [style.color, style.backgroundColor]; });
  expect(checkoutColors[0]).not.toBe(checkoutColors[1]);

  let resolveStatus!: () => void;
  const statusReady = new Promise<void>((resolve) => { resolveStatus = resolve; });
  await page.route("**/api/stripe/connect/status", async (route) => { await statusReady; await route.fulfill({ json: { connected: true, onboardingComplete: false, chargesEnabled: false, payoutsEnabled: false } }); });
  await page.goto("/en/e2e-ux?view=stripe");
  const refresh = page.getByRole("button", { name: "Refreshing…" });
  await expect(refresh).toBeDisabled();
  const disabledColors = await refresh.evaluate((element) => { const style = getComputedStyle(element); return [style.color, style.backgroundColor]; });
  expect(disabledColors[0]).not.toBe(disabledColors[1]);
  resolveStatus();
  await expect(page.getByRole("button", { name: "Refresh status" })).toBeEnabled();
});

test("seller compliance inputs and contact-message validation remain readable", async ({ page }) => {
  await page.goto("/ar/e2e-ux?view=seller");
  await dismissCookieConsent(page);
  const complianceInput = page.locator('input[name="productIdentifier"]');
  await complianceInput.fill("SKU-RTL-123");
  const inputColors = await complianceInput.evaluate((element) => { const style = getComputedStyle(element); return [style.color, style.backgroundColor]; });
  expect(inputColors[0]).not.toBe(inputColors[1]);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.goto("/fr/e2e-ux?view=contact");
  await dismissCookieConsent(page);
  const description = page.locator(".productDetailDescription");
  const descriptionBox = await description.boundingBox();
  const sectionBox = await page.locator(".productDetailDescriptionSection").boundingBox();
  expect(descriptionBox!.width).toBeLessThanOrEqual(sectionBox!.width);
  await page.getByRole("button", { name: "Demander au vendeur" }).click();
  const message = page.getByRole("textbox");
  await message.fill("Court");
  await expect(page.getByText("Votre message doit contenir au moins 12 caractères.")).toBeVisible();
  await expect(page.getByText("Le message n’a pas pu être envoyé.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Envoyer le message" })).toBeDisabled();
  await message.fill("Bonjour, disponible ?");
  await expect(page.getByRole("button", { name: "Envoyer le message" })).toBeEnabled();
});

test("product lower section is compact and report dialog is accessible", async ({ page }) => {
  await page.goto("/fr/e2e-ux?view=product-lower");
  await dismissCookieConsent(page);
  await expect(page.getByRole("heading", { name: "Informations sur le produit" })).toBeVisible();
  await expect(page.locator(".productCompliancePublic details")).toHaveCount(0);
  await expect(page.locator(".productDetailPage")).not.toHaveCSS("overflow-x", "scroll");
  const reportTrigger = page.getByRole("button", { name: "Signaler ce produit" });
  await reportTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Signaler ce produit" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("select")).toHaveCSS("color", "rgb(23, 59, 48)");
  await expect(dialog.locator("textarea")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(reportTrigger).toBeFocused();
});
