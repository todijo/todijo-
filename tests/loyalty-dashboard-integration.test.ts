import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("admin and seller loyalty pages are linked from their dashboards", () => {
  assert.match(source("app/adm-barewbar-182203/page.tsx"), /adm-barewbar-182203\/loyalty/);
  const sellerNav = source("components/SellerDashboardLayout.tsx");
  assert.match(sellerNav, /seller\/loyalty/);
  assert.match(sellerNav, /active === "loyalty"/);
  assert.match(source("app/seller/loyalty/page.tsx"), /SellerLoyaltyToggle/);
});

test("store participation and product eligibility use server-authoritative APIs", () => {
  assert.match(source("app/seller/loyalty/SellerLoyaltyToggle.tsx"), /api\/seller\/loyalty/);
  assert.match(source("app/api/seller/loyalty/route.ts"), /setStoreLoyaltyParticipation/);
  assert.match(source("app/api/products\/route.ts"), /productLoyaltyEligibility\(body\.loyaltyEligible, false\)/);
  assert.match(source("app/api/products/[id]/route.ts"), /Boolean\(currentSupplierLink\)/);
  assert.match(source("lib/loyalty-eligibility.ts"), /DROPSHIPPING_LOYALTY_FORBIDDEN/);
});

test("loyalty remains globally and per-store disabled by default", () => {
  const schema = source("prisma/schema.prisma");
  assert.match(schema, /model LoyaltyProgramSettings[\s\S]*enabled Boolean @default\(false\)/);
  assert.match(schema, /loyaltyEnabled Boolean @default\(false\)/);
  assert.match(source("lib/loyalty-settings.ts"), /enabled: false/);
});
