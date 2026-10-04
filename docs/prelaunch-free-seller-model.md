# Pre-launch FREE seller model

## Isolation and scope

Branch: `codex/prelaunch-free-seller-model`.
Baseline: `4f431418e59bb3b600881df3a22613fcec329ca2`.
Worktree: `C:\Users\allan\.codex\worktrees\prelaunch-free-seller-model\todijo--main`.

Local implementation/commit only. No push, merge, deployment, production restart,
production migration, production environment change, or live Stripe/CJ request.
The original dirty checkout and its local main were not used or modified.

## Seller entry and review

The old flow required a paid plan at registration and displayed another selector
even when the seller already had an explicit plan/interval.

Direct Seller registration now proceeds to the dashboard, with FREE setup/checklist
and optional comparison. A seller without a store compares plans on the public
seller page; they are not redirected in a subscription/dashboard loop.
Onboarding without paid intent returns to the dashboard after completion.

An explicit PLUS/PRO intent remains canonical and survives the existing
registration/login/verification/onboarding continuation. The subscription page
opens the selected paid plan review directly. Its single confirmation starts
Stripe Checkout. Modify returns to comparison; cancellation preserves selection.
Current prices remain server-derived and client amounts/Price IDs cannot override
the configured plan/interval mapping. Subscription success still requires
authoritative Stripe synchronization, not a client redirect.

## Plans and normal safety gates

| Tier | Monthly | Annual | Products | Stores / advanced capabilities |
|---|---:|---:|---:|---|
| FREE | €0 | No billing | 5 | One store; normal selling, orders and messages |
| PLUS | €14.99 | €143.90 | 50 | Normal selling; no PRO capabilities |
| PRO | €26.99 | €259.10 | Unlimited | Up to three stores, Team, dropshipping and new benefits |

Paid annual prices remain rounded-cent `monthly * 12 * 0.8`.
Commission and order/refund/payout/loyalty accounting are unchanged.

Commercial precedence is Admin exemption, valid paid PLUS/PRO, active valid Admin
grant, SELLER FREE baseline, then NONE. This is separate from seller/store
lifecycle, onboarding/legal requirements, suspension, verification and Connect.
FREE does not bypass existing server readiness/compliance/checkout guards.
Buying never requires a seller subscription.

Admin exemption remains tierless, permanent, non-paid PRO capability, with exactly
one own store. Timed seller grants support FREE/PLUS/PRO, preserve expiration and
auditability, and never outrank an authoritative paid subscription. Existing
Admin PENDING, eligible-owner, transition inspection, ownership and Team
permission protections remain in place.

## Product capacity and expiry

Creation retains the existing all-stored-product counting convention, including
drafts; variants are not separate products. The UI uses the same count as the
server, even when the browsable list excludes removed/test rows.

Creation and publication perform an authoritative recheck inside the product
transaction under a store quota advisory lock. Editing an existing publication
excludes its own ID. FREE cannot create a sixth product or publish beyond five;
PLUS remains capped at fifty and PRO/Admin exemption remain unlimited.

At paid expiry, public catalog/PDP/price/checkout predicates immediately limit
FREE visibility to the five oldest published products (createdAt, then ID).
Excess records are preserved and become non-sellable. Cleanup demotes excess
publications to DRAFT/SUBSCRIPTION_INACTIVE, never deletes them or republishes
them automatically. Seller-controlled unpublish/reactivation remains available
within the publication limit.

Store product-serving APIs evaluate expiry per request and do not CDN-cache
entitlement-sensitive product responses. The established short-lived web
store-directory metadata cache is preserved.

## Billing and transitions

FREE has no configured Stripe Price and never enters subscription Checkout.
Only these existing server configuration slots are used for new paid Checkout:

- STRIPE_SELLER_PLUS_MONTHLY_PRICE_ID
- STRIPE_SELLER_PLUS_ANNUAL_PRICE_ID
- STRIPE_SELLER_PRO_MONTHLY_PRICE_ID
- STRIPE_SELLER_PRO_ANNUAL_PRICE_ID

No production values or Stripe Products/Prices were changed.

FREE to PLUS/PRO uses the existing durable subscription Checkout retry/session
reuse protection and authoritative activation. PLUS to PRO, PRO to PLUS and paid
interval transitions retain the existing durable history, locks, correlation,
proration, ambiguous-failure recovery and late-webhook safeguards.

Paid to FREE schedules the existing subscription to finish its current paid
phase and cancel at the paid boundary. There is no second FREE phase or Stripe
Price. `todijo_free` is only an internal durable-history target marker and is
never sent to Stripe. Current paid entitlement remains until the boundary.
Completed schedules with a nullable subscription reference are resolved only
through durable schedule-ID/change-ID correlation and authoritative cancellation.

Converted BASIC billing identities are retained as history. The local migration
does not cancel any live Stripe subscription. A still-active unrecognized billing
record fails closed against duplicate Checkout creation until reconciled.
Converted FREE reminder rows cannot be claimed or sent as paid-plan reminders.

## PRO benefits

A shared web/mobile discovery service selects at most five eligible products per
PRO-capable store, in stable UTC-day rotation over oldest-first products. Stores
are round-robin interleaved with a rotating starting store. Requests do not
re-randomize the selection.

Paid PRO, Admin-granted PRO and Admin-exempt stores qualify. FREE/PLUS, suspended
stores, draft/removed/moderated/non-compliant/out-of-stock products do not.
The homepage reuses its existing ProductRail carousel; existing merchandising
sections are retained. Visibility is not a promise of sales/ranking.

PRO shipping supplies uses the existing SELLER_SUPPORT queue through an
owner-authorized, rate-limited, mutation-origin-protected request endpoint.
FREE/PLUS cannot submit. Copy promises access subject to availability/conditions,
not unlimited free supplies or automated fulfillment.

## Localization and mobile

New copy supplies clean French and English, with the established English fallback
and inherited RTL/responsive layouts. Existing translated seller/auth/payment
journey text is retained.

Mobile APIs share the authoritative catalog/checkout policies and expose an
optional `sections.proDiscovery` array in the shared HomeResponse contract.
No Flutter/Dart source or pubspec exists in this checkout; no Flutter UI was
changed. Native OAuth/registration database regressions were executed on the
repository-supported disposable URL.

## Migration

`20261004120000_introduce_free_seller_tier`:

- Converts BASIC test plan strings in subscription/current scheduled plan,
  grants, transition source/target history and reminder deliveries to FREE.
- Preserves users, stores, products, orders and billing identities.
- Adds nullable `Product.freeVisibilityPosition Int?`.
- Adds the storeId/freeVisibilityPosition index.
- Backfills deterministic published-product ranks.
- Adds PostgreSQL maintenance functions/trigger using the same store quota lock.

No unrelated reset, drop, destructive backfill or production execution.
All 66 migrations applied successfully on isolated PostgreSQL 17, including
65-migration baseline -> BASIC fixture -> new migration conversion checks.

## Validation

- `npm ci`: passed.
- `npx prisma generate`: passed, Prisma Client 6.19.3.
- `npx prisma validate`: passed.
- `npm run typecheck`: passed.
- Focused ESLint over every changed/new TS/TSX/MJS file: no errors; one pre-existing
  unused `_products` warning in the mobile store-detail serializer.
- `npm test`: 1,501 total, 1,492 passed, 9 database-gated skips, 0 failures.
- Focused seller/Admin/Stripe/payment/refund/loyalty/CJ/mobile/homepage/auth/quota
  regressions: 638 passed, 9 database-gated skips, 0 failures.
- `node scripts/validate-free-seller-postgres.mjs`: 2 FREE/transition PostgreSQL
  tests and 11 native OAuth/registration tests passed with no skips. This explicitly
  executes all 9 database-gated cases from the normal full suite.
- PostgreSQL checks cover real query eligibility, five-product visibility,
  expiry-before-worker behavior, concurrent fifth-slot publication, no blind
  republication, BASIC conversion, upgrade webhook correlation and native
  registration/OAuth persistence/concurrency.
- Isolated Next.js production build: passed with local placeholder DB and no
  Stripe secret. No production server was started.
- `git diff --check`: passed.

The helper creates its own SCRAM-protected loopback PostgreSQL cluster, never
uses the caller's DATABASE_URL, refuses occupied test ports, and destroys only
its own temporary cluster. Existing todijo_local and production are untouched.

## Remaining follow-up (not implemented)

Store display-name versus slug/URL approval:
seller display-name change; request-only slug change; Admin approval/rejection;
Admin-only authoritative slug mutation; safe old-slug redirect; protected-name,
trademark and rename-lock protections.

## Exact task file manifest

- `.env.example`
- `app/HomeClient.tsx`
- `app/adm-barewbar-182203/AdminDashboard.tsx`
- `app/api/auth/register/route.ts`
- `app/api/marketplace/home/route.ts`
- `app/api/marketplace/stores/[slug]/route.ts`
- `app/api/marketplace/stores/route.ts`
- `app/api/products/[id]/route.ts`
- `app/api/products/route.ts`
- `app/api/seller/shipping-supplies/route.ts`
- `app/dashboard/page.tsx`
- `app/e2e-ux/page.tsx`
- `app/page.tsx`
- `app/register/RegisterForm.tsx`
- `app/register/page.tsx`
- `app/sell/SellerPlanChooser.tsx`
- `app/sell/page.tsx`
- `app/seller/create-store/page.tsx`
- `app/seller/onboarding/page.tsx`
- `app/seller/payment-setup/page.tsx`
- `app/seller/products/new/NewProductForm.tsx`
- `app/seller/products/new/page.tsx`
- `app/seller/products/page.tsx`
- `app/seller/shipping-supplies/SuppliesRequestForm.tsx`
- `app/seller/shipping-supplies/page.tsx`
- `app/seller/subscription/SubscriptionPlans.tsx`
- `app/seller/subscription/page.tsx`
- `app/store/[slug]/page.tsx`
- `app/store/page.tsx`
- `components/AdminAccessStatus.tsx`
- `components/AdminManagedPlanControl.tsx`
- `components/FreeSellerStartCard.tsx`
- `docs/prelaunch-free-seller-model.md`
- `i18n/seller-free-model.ts`
- `i18n/seller-subscription-reminders.ts`
- `lib/admin-access-status.ts`
- `lib/admin-access.ts`
- `lib/admin-managed-plan.ts`
- `lib/payments.ts`
- `lib/pro-homepage-discovery.ts`
- `lib/pro-shipping-supplies.ts`
- `lib/product-variants.ts`
- `lib/seller-commercial-access.ts`
- `lib/seller-onboarding-flow.ts`
- `lib/seller-plan-recommendation.ts`
- `lib/seller-plans.ts`
- `lib/seller-publication-capacity.ts`
- `lib/seller-registration-intent.ts`
- `lib/seller-subscription-changes.ts`
- `lib/seller-subscription-checkout.ts`
- `lib/seller-subscription-reminders.ts`
- `lib/seller-subscription.ts`
- `lib/stripe.ts`
- `mobile/packages/contracts/dist/index.d.ts`
- `prisma/migrations/20261004120000_introduce_free_seller_tier/migration.sql`
- `prisma/schema.prisma`
- `scripts/validate-free-seller-postgres.mjs`
- `tests/admin-access-status.test.ts`
- `tests/admin-access.test.ts`
- `tests/admin-exempt-capabilities.test.ts`
- `tests/admin-managed-plan.test.ts`
- `tests/admin-product-entitlement-regression.test.ts`
- `tests/admin-store-owner-eligibility.test.ts`
- `tests/admin-subscription-changes.test.ts`
- `tests/catalog-data-isolation.test.ts`
- `tests/dashboard.test.ts`
- `tests/homepage-hero-merchandising.test.ts`
- `tests/mobile-buyer-api.test.ts`
- `tests/payments.test.ts`
- `tests/product-removal.test.ts`
- `tests/seller-free-model.test.ts`
- `tests/seller-free-postgres.test.ts`
- `tests/seller-legal-forms.test.ts`
- `tests/seller-onboarding-convergence.test.ts`
- `tests/seller-plan-selection-flow.test.ts`
- `tests/seller-plans-foundation.test.ts`
- `tests/seller-signup-continuity.test.ts`
- `tests/seller-subscription-changes-postgres.test.ts`
- `tests/seller-subscription-changes.test.ts`
- `tests/seller-subscription-lifecycle.test.ts`
- `tests/seller-subscription-stripe-lifecycle.test.ts`
- `tests/seller-subscription.test.ts`
- `tests/supplier-access.test.ts`
