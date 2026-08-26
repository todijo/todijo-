import { expect, test } from "@playwright/test";
import { dismissCookieConsent } from "./helpers";

test("buyer selects an exact variant, adds it to cart, and reaches safe checkout initiation", async ({ page }) => {
  await page.route("**/api/products/buyer-pricing", (route) => route.fulfill({ json: { prices: [{ productId: "stage5-variant-product", variantId: "variant-blue-m", kind: "productPrice", amount: "24", currency: "EUR" }, { productId: "stage5-variant-product", variantId: "variant-black-s", kind: "productPrice", amount: "21", currency: "EUR" }] } }));
  await page.route("**/api/products?ids=**", (route) => route.fulfill({ json: { products: [{ id: "stage5-variant-product", sellerType: "PRIVATE" }] } }));
  await page.route("**/api/account/addresses", (route) => route.fulfill({ json: { addresses: [] } }));
  await page.goto("/en/e2e-ux?view=buyer-path");
  await dismissCookieConsent(page);
  await page.getByRole("button", { name: "Blue" }).click();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await expect(page.getByText("Color: Blue · Size: M")).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.goto("/en/cart");
  await expect(page.getByText("Stage 5 variant product")).toBeVisible();
  await expect(page.getByText("Color: Blue · Size: M")).toBeVisible();
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("todijo-cart-v1") ?? "[]"));
  expect(cart).toEqual([expect.objectContaining({ id: "stage5-variant-product", variantId: "variant-blue-m", quantity: 1 })]);
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await expect(page).toHaveURL(/\/en\/checkout$/);
  await expect(page.getByRole("heading", { name: "Complete my order" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add a shipping address" })).toBeVisible();
});
