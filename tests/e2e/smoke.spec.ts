import { expect, test, type Page } from "@playwright/test";

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    const expectedNotFoundResponse = text.includes("Failed to load resource") && text.includes("404");
    if (message.type() === "error" && !expectedNotFoundResponse) errors.push(text);
  });
  return () => expect(errors, "unexpected browser runtime errors").toEqual([]);
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
