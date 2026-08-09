import { expect, test } from "@playwright/test";
import { collectRuntimeErrors } from "./helpers";
import { SignJWT } from "jose";

const e2eSecret = "e2e-only-placeholder-secret-at-least-32-characters";

async function authenticate(page: import("@playwright/test").Page, userId: string) {
  const token = await new SignJWT({ userId, role: "CUSTOMER" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(e2eSecret));
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

test("desktop filters are on-demand and preserve URL filter behavior", async ({ page }) => {
  await page.goto("/en/e2e-ux");
  const trigger = page.locator(".mobileFilterButton");
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("dialog", { name: "Filters" })).toHaveCount(0);
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  await expect(dialog).toBeVisible();
  await page.getByLabel("Minimum price").fill("10");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
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
