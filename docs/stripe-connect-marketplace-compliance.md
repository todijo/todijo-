# Stripe Connect marketplace compliance

This internal document maps Stripe's marketplace requirements to Todijo's application controls. It contains no credentials and does not assert that production seller data has already been remediated.

## Funds-flow architecture

Todijo creates buyer Checkout Sessions on the platform and records one authoritative `OrderGroup` per marketplace seller or platform-owned CJ group. Marketplace groups snapshot the seller's Express connected-account ID and seller net allocation. The platform charge is followed by an idempotent, delayed Connect transfer only after shipment, maturity, risk, and reserve eligibility. `CJ_PLATFORM` groups have no seller connected-account destination and never enter seller-transfer processing. This is Stripe Connect's separate-charges-and-transfers model; Todijo does not silently mix it with destination charges.

## Requirement evidence

| Requirement | Code and database evidence | Runtime protection | Automated evidence | Production verification |
| --- | --- | --- | --- | --- |
| Every marketplace seller uses Connect | `User.stripeAccountId`, `stripeOnboardingComplete`, `stripeChargesEnabled`, and `stripePayoutsEnabled` in `prisma/schema.prisma`; Express creation in `lib/stripe.ts` | `lib/payments.ts` retrieves every marketplace seller account using the platform key before creating or reusing Checkout | `tests/payments.test.ts`, `tests/stripe-connect-readiness.test.ts` | Open Admin → Stripe Connect readiness; remediate every non-ready row; then perform an authoritative live account retrieval audit |
| Existing-seller remediation | `app/adm-barewbar-182203/connect-readiness/page.tsx` lists each seller, masked account reference, readiness state, and required action | Report is admin-only, read-only, and never creates or replaces accounts | `tests/stripe-connect-readiness.test.ts` | Overall state must be `COMPLIANT`; investigate every `ACTION REQUIRED` row |
| Safe onboarding and resume | `app/api/stripe/connect/account/route.ts`, Connect return/refresh pages, and `components/StripeConnectSection.tsx` | An account is created only when the authenticated seller has no stored ID. Resume generates a new Account Link for the same ID. Stripe creation uses a seller-scoped idempotency key | `tests/stripe-connect-readiness.test.ts`, `tests/e2e/smoke.spec.ts` | Each affected seller signs in and uses Dashboard → Connect Stripe; never bulk-create or replace IDs |
| Checkout fails closed | `lib/payments.ts`; `OrderGroup.stripeConnectedAccountId` | Server resolves products/stores/prices, retrieves each applicable account, verifies exact ID, onboarding, charges, and payouts, and fails closed on Stripe errors. Existing Checkout URL reuse repeats validation | `tests/payments.test.ts`, `tests/stripe-connect-readiness.test.ts`, `tests/multi-vendor-policy.test.ts` | In Stripe test mode, verify missing, incomplete, disabled, stale, and mixed-seller carts cannot receive a Checkout URL |
| Multi-seller and CJ separation | `OrderGroup.kind` (`MARKETPLACE` or `CJ_PLATFORM`), grouping in `lib/payments.ts` | Every marketplace store is validated; eligible platform-owned CJ lines group as `cj:platform` with no seller account or seller net transfer | `tests/multi-vendor-policy.test.ts`, `tests/stripe-connect-readiness.test.ts`, supplier fulfillment tests | Inspect representative mixed orders and confirm group kinds/account snapshots match ownership |
| Seller transfers and reserves | `lib/seller-transfers.ts`, `lib/seller-maturity.ts`; transfer status/idempotency fields on `OrderGroup` | Claim requires `MARKETPLACE`, readiness/eligibility, and a non-null snapshot. Current seller ID must exactly match the snapshot; Stripe is retrieved immediately before transfer and must remain ready | `tests/stripe-connect-readiness.test.ts`, `tests/multi-vendor-policy.test.ts` | Reconcile ready/retryable groups; confirm no CJ group has a seller transfer and no destination differs from the seller record |
| Webhook synchronization | `app/api/stripe/webhook/route.ts`, `processStripeEvent` in `lib/payments.ts`, `StripeWebhookEvent` | Raw-body signature verification, five-minute tolerance, explicit live/test mode match, event-ID idempotency, and account-ID-scoped updates. `account.updated` synchronizes all three readiness fields, including capability disablement | `tests/payments.test.ts` | Confirm the platform webhook subscribes to connected-account `account.updated`; inspect delivery success and mode configuration. Authenticated status refresh remains an additional authoritative poll |
| Test/live isolation | `configuredStripeMode`, `validateStripeSecretKey`, and `assertStripeWebhookMode` in `lib/stripe.ts` | Production requires explicit `STRIPE_MODE`; secret-key prefix and webhook `livemode` must match | `tests/payments.test.ts` | Verify deployment variables without copying secrets into tickets or logs |
| Financial-history retention | `lib/admin-user-deletion.ts` and PR #31 admin deletion routes | Stripe-connected sellers, buyer orders, seller order groups, admin audit history, and supplier audit history block physical deletion; remediation uses protected anonymization | `tests/admin-safe-user-deletion.test.ts` | Preview deletion for a historical seller and confirm `hardDeleteSafe=false` with financial blockers |

## Operational definition

The admin view shows `COMPLIANT` only when every store owner has a stored connected-account ID, completed onboarding, charges enabled, and payouts enabled. This is a strict persisted-data gate. It is not a substitute for Stripe retrieval: checkout and transfer execution always revalidate through the platform key.

Before telling Stripe that all existing sellers are migrated:

1. Deploy the application and confirm `STRIPE_MODE=live`, the live platform secret, webhook secret, HTTPS Connect return/refresh URLs, and application URL are correctly configured.
2. Confirm connected-account `account.updated` webhook deliveries succeed and no mode mismatch is present.
3. Open `/adm-barewbar-182203/connect-readiness`; require `COMPLIANT`, `Fully ready = Total marketplace sellers`, and zero in every remediation category.
4. For each stored account ID, perform a controlled read-only retrieval with the Todijo live platform key and confirm the returned ID matches and `details_submitted`, `charges_enabled`, and `payouts_enabled` are true. Treat retrieval errors or mismatches as non-compliant; never create a replacement automatically.
5. Let each non-ready seller explicitly start or resume Stripe-hosted onboarding from their authenticated dashboard and repeat the audit.
6. Reconcile pending pre-deployment Checkout Sessions before making the final support statement.

Only after these production checks pass may Todijo state that all existing marketplace merchants have been migrated. Independently of production data completion, the application enforcement statement is: ordinary marketplace sellers who are not authoritative, ready Stripe Connected Accounts cannot start or reuse marketplace Checkout and cannot receive seller transfers.
