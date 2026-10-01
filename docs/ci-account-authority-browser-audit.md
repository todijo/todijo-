# CI account authority and browser audit

Base: `b1f3c5afdeef6567d0640f4a88042dcd39aee3ec` (latest fetched main).

## Deterministic quality-gate failure

The source regex `/role|ADMIN|dropshipping/` rejected the legitimate server-side
`session.role === "CUSTOMER"` branch added by the authoritative buyer-address
change. The route was secure; the assertion was stale. Production profile,
validation and session code are unchanged.

The new tests transpile and invoke the actual PATCH handler, stubbing only its
session and Prisma boundaries and using the real validator and NextResponse.
For CUSTOMER, SELLER and ADMIN sessions they assert the complete update payload
and the authenticated user ID. Forged identity, role, admin, permissions,
seller verification, dropshipping authorization, Stripe identity, auth version,
block state and nested store changes never reach Prisma. CUSTOMER writes only
firstName/lastName; SELLER/ADMIN writes only the existing seven profile fields.
Unauthenticated and invalid requests perform no writes.

Validation: 24 focused account tests passed on three consecutive runs. Full unit
suite: 1,233 tests, 1,226 passed, 7 skipped, zero failures before browser fixes and again after the final browser fixes.

## Add-to-cart race

Reproduced against the actual buyer-path fixture with mocked country/session:
FR/EUR + Blue/M displayed EUR 24 while `.addCartButton` remained disabled;
US/USD + Blue/M displayed USD 24 and enabled the button.

`BuyerProductPrice` resolves same-currency prices synchronously in a child
passive effect. The parent passive effect then cleared marketplacePricing on
variant change. A later conversion/network response avoided the ordering race.
The existing non-dropshipping reset now uses a layout effect, before the child
passive effect. No prices, conversion rules, CJ quote handling, stock rules or
checkout rules changed. Reproduction now enables the button for both currencies.

The smoke test fixes its country/session fixture and explicitly waits for the
selected variant's resolved 24.00 price, non-busy price state, enabled cart
button and correct accessible name. No timeout increase or forced click.

## Exact 559px mobile overflow

Both reported mobile tests reproduced the exact failure with DOM diagnostics:

```json
{"overflow":559,"width":390,"readyState":"loading","elements":[{"tag":"IMG","left":8,"right":949,"width":941,"position":"static","display":"inline"}]}
```

The startup artwork image has intrinsic width 941. Before route styles were
ready it occupied normal flow at the default 8px body margin: 949 - 390 = 559.
This was a stylesheet/redirect intermediate state, not the authenticated form,
navigation drawer or page skeleton.

Existing startup positioning/clipping and image sizing are now inline so they
apply before CSS loads. Normal styled layout remains the same. The two tests
also wait for startup dismissal before evaluating the usable page. The shared
overflow assertion still checks the real document width immediately and now
reports offending element geometry; it does not suppress overflow failures.

Three reported scenarios passed twice with zero retries. A separate regression
test removes CSS and disables JavaScript: startup bounds remain exactly
x=0, width=390, height=844.

Broader browser baseline: 8 passed / 6 failed. Two failures were the reproduced
overflow. Information-page cases rendered the branded website error boundary
because this isolated environment has no test database; another fixture click
timed out under the initial load. The full database-backed smoke suite is not
claimed green. No schema changes, fixture database writes or migrations ran.

## Dependency audit (separate assessment, no upgrades)

Current locked install: two high-severity package groups in full npm audit;
one high-severity group with `--omit=dev`.

- `nodemailer@9.1.1`: direct production dependency. Recipient strings reach
  `mailTransport().sendMail` through `lib/email/transport.ts`; address-parser
  CPU denial of service is a real runtime risk, not just a build warning.
  SMTP configuration and upstream validation determine practical exposure;
  no exploit was run. npm reports the aggregate fix as 10.0.13, a major upgrade.
  The registry lists no patched 9.x release beyond installed 9.1.1. A safe
  patch/minor fix is therefore not currently available on this major line.
  A separate reviewed mail compatibility/security update is needed.
- `brace-expansion@1.1.18` and `5.0.9`: transitive development-only ESLint /
  TypeScript-ESLint dependencies; both lock entries have `dev:true`. They are
  build/lint tooling exposure, not application runtime after dev pruning.
  Same-major patched versions 1.1.21 and 5.0.12 exist. A focused lock refresh
  is possible separately; no dependency changes were made here.

Maintainer advisories:

- https://github.com/advisories/GHSA-v53p-9fqp-m79j
- https://github.com/advisories/GHSA-prgh-xp8r-p3m5

No `npm audit fix`, force upgrade, email behavior change or credential access.

## Validation limitations

Docker/Podman commands and the standard Docker Desktop executable are absent,
so the container image/non-root health smoke test cannot run on this host.
Container security source tests run in the unit suite, but are not a substitute
for executing the image. Static follow-up: the current Docker deps stage copies
package.json/package-lock.json/prisma before npm ci, while package.json now
references `file:mobile/packages/contracts`; that directory is not explicitly
copied into the deps stage. Confirm this independently when Docker is available.

Only local work and commits are authorized. No push, deploy, production restart,
database migration, mobile Flutter branch edits or financial-rule changes.

Final checks: TypeScript passed; repository lint passed with 10 existing warnings
and zero errors; changed-file lint has only the existing startup img warning.
The full final unit suite again passed 1,226 / 1,233, with 7 skipped, zero failed.
Git diff --check passed. Final production build result is recorded in the final
report and ignored .test-dist/final-production-build.log.

## Exact changed files

Commit 1 (8843c48f3abc8f05255fbb8d1ee94ead7e89b64a):
- tests/account-auth-onboarding-v2.test.ts
- tests/account-profile-authority.test.ts

Commit 2 (browser correction and audit; SHA in final report):
- components/ProductPurchasePanel.tsx
- components/MobileStartupArtwork.tsx
- tests/e2e/stage5-smoke.spec.ts
- tests/e2e/mobile.spec.ts
- tests/e2e/helpers.ts
- docs/ci-account-authority-browser-audit.md
Final production build passed (exit 0, existing warnings only). Local production
mode /api/health returned HTTP 200. This does not replace container smoke testing.
