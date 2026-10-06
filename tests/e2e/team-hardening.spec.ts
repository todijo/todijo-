import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { CANONICAL_LEAF_CATEGORIES } from "../../lib/desktop-category-taxonomy";

const secret = "e2e-only-placeholder-secret-at-least-32-characters";
const db = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const ownerId = `pro-team-browser-owner-${suffix}`;
const memberId = `pro-team-browser-member-${suffix}`;
const adminId = `pro-team-browser-admin-${suffix}`;
const buyerId = `pro-team-browser-buyer-${suffix}`;
const applicantId = `pro-team-browser-applicant-${suffix}`;
const businessId = `pro-team-browser-business-${suffix}`;
const store2Id = `pro-team-browser-store-2-${suffix}`;
const store3Id = `pro-team-browser-store-3-${suffix}`;
const reviewBusinessId = `pro-team-browser-review-business-${suffix}`;
const reviewStoreId = `pro-team-browser-review-store-${suffix}`;
const membershipId = `pro-team-browser-membership-${suffix}`;

async function setSession(page: import("@playwright/test").Page, userId: string, role: "SELLER" | "CUSTOMER" | "ADMIN") {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { authVersion: true } });
  const token = await new SignJWT({ userId, role, authVersion: user.authVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  await page.context().addCookies([{ name: "todijo_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
}

async function cleanupFixtures() {
  await db.sellerTeamMembership.deleteMany({ where: { id: membershipId } });
  await db.store.deleteMany({ where: { id: { in: [store2Id, store3Id, reviewStoreId] } } });
  await db.sellerBusiness.deleteMany({ where: { id: { in: [businessId, reviewBusinessId] } } });
  await db.user.deleteMany({ where: { id: { in: [ownerId, memberId, adminId, buyerId, applicantId] } } });
}

test.beforeAll(async () => {
  await db.$transaction(async (tx) => {
    await tx.user.createMany({ data: [
      { id: ownerId, firstName: "PRO", lastName: "Owner", email: `pro-team-browser-owner-${suffix}@e2e.todijo.test`, role: "SELLER", emailVerified: true, authVersion: 0 },
      { id: memberId, firstName: "Scoped", lastName: "Member", email: `pro-team-browser-member-${suffix}@e2e.todijo.test`, role: "CUSTOMER", emailVerified: true, authVersion: 0 },
      { id: adminId, firstName: "Review", lastName: "Admin", email: `pro-team-browser-admin-${suffix}@e2e.todijo.test`, role: "ADMIN", emailVerified: true, authVersion: 0 },
      { id: buyerId, firstName: "Buyer", lastName: "Only", email: `pro-team-browser-buyer-${suffix}@e2e.todijo.test`, role: "CUSTOMER", emailVerified: true, authVersion: 0 },
      { id: applicantId, firstName: "Pending", lastName: "Seller", email: `pro-team-browser-applicant-${suffix}@e2e.todijo.test`, role: "SELLER", emailVerified: true, authVersion: 0 },
    ] });
    await tx.sellerBusiness.create({ data: { id: businessId, ownerId, maxStores: 3, inseeVerificationState: "VERIFIED" } });
    await tx.store.createMany({ data: [
      { id: store2Id, name: `PRO Browser Store 2 ${suffix}`, slug: store2Id, country: "FR", city: "Paris", contactEmail: `pro-team-browser-owner-${suffix}@e2e.todijo.test`, ownerId, businessId, status: "ACTIVE", sellerType: "PROFESSIONAL", onboardingStatus: "VERIFIED", onboardingStep: 4 },
      { id: store3Id, name: `PRO Browser Store 3 ${suffix}`, slug: store3Id, country: "FR", city: "Lyon", contactEmail: `pro-team-browser-owner-${suffix}@e2e.todijo.test`, ownerId, businessId, status: "ACTIVE", sellerType: "PROFESSIONAL", onboardingStatus: "VERIFIED", onboardingStep: 4 },
    ] });
    await tx.sellerBusiness.update({ where: { id: businessId }, data: { billingStoreId: store2Id } });
    await tx.user.update({ where: { id: ownerId }, data: { primaryStoreId: store2Id } });
    await tx.sellerSubscription.create({ data: { id: "pro-team-browser-subscription", storeId: store2Id, stripeSubscriptionId: "sub_test_pro_team_browser", stripePriceId: "price_test_pro_monthly", plan: "pro", billingInterval: "monthly", status: "ACTIVE", currentPeriodStart: new Date(Date.now() - 60_000), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) } });
    await tx.sellerTeamMembership.create({ data: { id: membershipId, businessId, userId: memberId, status: "ACTIVE", roleTemplate: "CUSTOM", permissions: ["PRODUCT_VIEW"], assignments: { create: { storeId: store2Id, productScope: "SELECTED_CATEGORIES", categoryKeys: [CANONICAL_LEAF_CATEGORIES[0].id] } } } });
    await tx.sellerBusiness.create({ data: { id: reviewBusinessId, ownerId: applicantId } });
    await tx.store.create({ data: { id: reviewStoreId, name: `Pending Review Store ${suffix}`, slug: reviewStoreId, country: "FR", city: "Paris", contactEmail: `pro-team-browser-applicant-${suffix}@e2e.todijo.test`, ownerId: applicantId, businessId: reviewBusinessId, status: "PENDING", sellerType: "PROFESSIONAL", onboardingStatus: "PENDING_REVIEW", onboardingStep: 4 } });
  });
});

test.afterAll(async () => {
  try { await cleanupFixtures(); }
  finally { await db.$disconnect(); }
});

test("PRO owner and assigned member stay store-scoped with owner-managed password controls", async ({ browser }) => {
  test.setTimeout(90_000);
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await setSession(ownerPage, ownerId, "SELLER");
  await ownerPage.goto("/en/seller/team");
  await expect(ownerPage.getByRole("heading", { level: 1, name: "Team" })).toBeVisible();
  const memberCard = ownerPage.locator(".sellerTeamMember").filter({ hasText: "Scoped Member" }).first();
  await expect(memberCard).toContainText(`PRO Browser Store 2 ${suffix}`);
  await expect(memberCard).not.toContainText(`PRO Browser Store 3 ${suffix}`);
  await expect(ownerPage.getByLabel("Product access").first()).toBeVisible();
  await expect(ownerPage.getByLabel("Product access").first().locator("option", { hasText: "Limit to selected categories" })).toHaveCount(1);
  await expect(memberCard.locator('input[name="newPassword"]')).toBeVisible();
  await expect(memberCard.getByRole("button", { name: "Set password" })).toBeVisible();
  for (const width of [768, 390, 320]) {
    await ownerPage.setViewportSize({ width, height: 844 });
    await ownerPage.reload();
    await expect(ownerPage.getByRole("heading", { level: 1, name: "Team" })).toBeVisible();
    const dimensions = await ownerPage.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content, `team page horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
  }

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await setSession(memberPage, memberId, "CUSTOMER");
  await memberPage.goto(`/en/seller/products?store=${store2Id}`);
  await expect(memberPage).toHaveURL(new RegExp(`/en/seller/products\\?store=${store2Id}$`));
  await expect(memberPage.locator(".sellerProductSummary").first()).toBeVisible();
  await expect(memberPage.getByText(`PRO Browser Store 3 ${suffix}`)).toHaveCount(0);
  await memberPage.goto(`/en/seller/products?store=${store3Id}`);
  await expect(memberPage).toHaveURL(/\/en\/dashboard$/);
  await memberContext.close();

  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  await setSession(buyerPage, buyerId, "CUSTOMER");
  await buyerPage.goto("/en/dashboard");
  await expect(buyerPage).toHaveURL(/\/en\/dashboard$/);
  await expect(buyerPage.getByRole("heading", { level: 1, name: /Buyer/ })).toBeVisible();
  await expect(buyerPage.locator(".dashboardSkeleton")).toHaveCount(0);
  await buyerContext.close();
  await ownerContext.close();
});

test("Admin can see the current seller-review queue and pending count", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await setSession(page, adminId, "ADMIN");
  await page.goto("/en/adm-barewbar-182203/seller-review");
  await expect(page.getByRole("heading", { name: "Seller verification review" })).toBeVisible();
  await expect(page.locator(".adminSellerReviewCard h2", { hasText: `Pending Review Store ${suffix}` }).first()).toBeVisible();
  await expect(page.locator(".adminSellerReviewSummary").first()).toHaveText("1");
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Seller verification review" })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content, `Admin review horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
  await context.close();
});
