# Todijo production operations runbook

## Readiness verdict

Repository code is production-ready, but deployment is `PRODUCTION_READY_WITH_ACTIONS` until the external checklist below is verified. Green CI cannot prove live credentials, schedules, backups, balances, DNS, or provider account status.

## Safe deploy

1. Back up PostgreSQL and record the restore point. Verify restore procedures outside production.
2. Confirm the release contains only reviewed forward migrations. Never edit an already-deployed migration.
3. Confirm all required environment values below without printing them.
4. Deploy with the configured startup command `npx prisma migrate deploy && npm run start`.
5. Check `GET /api/health`; it proves application liveness only and intentionally does not call PostgreSQL or third parties.
6. Verify a read-only public page and inspect CI/deployment logs for migration or configuration errors.
7. Run `npm run audit:production-readiness` against a read-only database role where possible. It never repairs data.

## Environment contract

Required core values are `DATABASE_URL`, a 32+ character `SESSION_SECRET`, and an HTTPS `APP_URL`. Stripe commerce requires `STRIPE_MODE`, a matching `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`. Connect onboarding additionally requires HTTPS `STRIPE_CONNECT_REFRESH_URL` and `STRIPE_CONNECT_RETURN_URL`; subscription plans require their Stripe price IDs.

Each internal runner requires a distinct secret: `SUPPLIER_SYNC_CRON_SECRET`, `SELLER_TRANSFER_CRON_SECRET`, `REFUND_FINANCIAL_CRON_SECRET`, and—only after the French catalog pilot is approved—`CATALOG_TRANSLATION_CRON_SECRET`. Missing secrets fail closed. Schedule the existing three POST endpoints every 15 minutes with `Authorization: Bearer <secret>`:

- `/api/internal/supplier-sync`
- `/api/internal/seller-transfers`
- `/api/internal/refund-financials`

Catalog translation deploys disabled. After Microsoft credentials, all character ceilings, and `CATALOG_TRANSLATION_ENABLED=true` are configured, schedule `POST /api/internal/catalog-translations` separately. Begin with an Admin-selected five-product French job, approve each stored proposal, then repeat with twenty products. Never expose the runner secret or submit arbitrary text to it.

FX-backed multi-currency pricing requires `OPEN_EXCHANGE_RATES_APP_ID` and fails closed when unavailable or stale. OAuth providers are optional and remain disabled unless their complete client ID/secret pair is set. SMTP, R2, Cloudinary, Turnstile, and CJ credentials are feature-specific; validate each enabled feature before advertising it.

`CJ_AUTOMATIC_FULFILLMENT_ENABLED` must reflect an explicit operational decision. Keep it `false` until CJ credentials, balance, address handling, reconciliation, and operator coverage are verified. No automatic CJ order is submitted while false.

## Stripe and Connect

Configure the production webhook at `POST https://todijo.com/api/stripe/webhook`. Todijo uses Checkout completion/async success/expiry, payment failure, Connect account updates, and seller-subscription lifecycle events. Subscribe only to events exercised by the deployment. The handler verifies the raw-body signature, rejects a mismatched `event.livemode`, and records webhook identity before stock/payment finalization.

The legacy WooCommerce destination `https://todijo.com/?wc-api=wc_stripe` is not a Todijo application endpoint and has no code, configuration, or runtime dependency in this repository. After the production endpoint above is enabled with its own `STRIPE_WEBHOOK_SECRET` and successful deliveries are confirmed, an operator can disable or remove the legacy destination in Stripe. Do not reuse the legacy endpoint secret: each Stripe event destination has its own signing secret.

Confirm Stripe live keys belong to the intended account, Connect is enabled, payout settings are intentional, and every active marketplace seller has the persisted connected account expected by Todijo. Do not replace historical transfer destinations when an account changes.

## Financial operations

Seller payment is deferred until verified shipment. STANDARD groups become ready immediately, NEW groups reserve for seven days, and HIGH_RISK groups require database-authoritative admin release with a reason and audit event. The transfer runner uses durable claims and Stripe idempotency. Ambiguous attempts reuse the exact amount/key; definite failures rotate the generation before entitlement can change.

Refund completion and seller recovery are separate durable operations. Pre-transfer refunds reduce entitlement; post-transfer refunds create a reversal against the persisted original transfer. Review `MANUAL_ACTION_REQUIRED`, repeated `RETRYABLE`, and stale `PROCESSING` records. Never repair financial state with ad-hoc SQL: preserve Stripe IDs and reconcile evidence first.

Returns are financially independent. Receipt and inspection never restore stock. Only an authoritative completed-refund Marketplace return marked RESTOCKABLE can be explicitly restocked. Legacy and CJ restock events remain non-actionable.

## Diagnostics and escalation

The read-only audit reports stuck claims, manual financial states, negative stock, invalid group identities, accounting overages, over-refunds, over-reversals, over-restocks, and malformed Stage 4 records. A FAIL requires investigation and an explicitly reviewed corrective action. A WARN requires queue/runner/admin review. The command prints counts, not secrets or customer data.

The post-payment inventory model has a known oversell window: stock is checked at checkout and atomically decremented at webhook finalization. If another payment consumes the last unit first, the later paid webhook remains failed/retryable rather than making stock negative. Operators must reconcile the paid order and refund or fulfill it explicitly; do not mark it successful silently.

## External checklist

- Stripe: live account active, mode-matching keys, webhook endpoint/events, Connect enabled, seller restrictions resolved, payout settings reviewed.
- Hosting/Coolify: current `main`, complete environment, three 15-minute scheduled POST tasks, healthcheck, retained deployment logs.
- PostgreSQL: automated backups, tested restore, capacity/connection monitoring, migration rollback/escalation procedure.
- CJ: valid credentials, rate limits, balance dependency, reconciliation process, intentional automatic-fulfillment flag.
- Domain: HTTPS, canonical `APP_URL`, DNS, OAuth redirect URIs.
- Email: authenticated sender domain, SMTP delivery and bounce monitoring.
- Media/abuse: R2/Cloudinary and Turnstile enabled where the corresponding production feature requires them.

Rollback application code only when the deployed schema remains backward-compatible. Do not roll back a migration destructively. For financial incidents, disable the affected scheduled task, retain evidence, and reconcile Stripe/CJ state before resuming.

## Dependency audit

Stage 6 updated Next.js to 15.5.24, next-intl to 4.9.2, Playwright to 1.55.1, and Sharp to 0.35.4, removing the directly actionable runtime and browser advisories without a framework-major migration. `npm audit --omit=dev` still reports five advisory entries (four high, one moderate) through Prisma CLI configuration and PostCSS bundled by Next. The suggested automated remedies are disruptive (a Prisma downgrade or Next 16 upgrade), so they were not forced into this final audit. Track upstream fixed releases and schedule a dedicated compatibility-tested upgrade; do not treat the residual count as zero.
