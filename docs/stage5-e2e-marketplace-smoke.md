# Stage 5 marketplace lifecycle audit

Initial classification: `PARTIALLY_READY`.

Before Stage 5, Todijo had deterministic coverage for checkout idempotency, exact variant stock decrement, multi-vendor group persistence, STANDARD/NEW/HIGH_RISK payout policy, stale transfer recovery, refund allocations, definite-failure transfer key rotation, transfer reversals, physical returns, legacy return isolation, CJ isolation, authorization, and production startup migrations. Those checks were split across Stage-specific suites. Browser smoke tests covered the marketplace shell and cart presentation, but not exact variant selection through checkout initiation.

Stage 5 adds a cross-stage invariant suite and a browser smoke fixture that is unavailable in production. The browser path selects an exact variant, records that identity in the cart, reaches checkout, and stops at the isolated address/test boundary. Financial correctness remains deterministic and mocked; no test invokes live Stripe or CJ operations.

The audit found one configuration defect: `POST /api/internal/refund-financials` required `REFUND_FINANCIAL_CRON_SECRET`, but the variable was missing from `.env.example`. The environment contract now documents a distinct secret without exposing any value.

Production contracts:

- `STRIPE_MODE` must explicitly match Stripe credentials and webhook event mode.
- `STRIPE_WEBHOOK_SECRET` verifies webhook signatures.
- `SELLER_TRANSFER_CRON_SECRET` protects the seller-transfer runner.
- `REFUND_FINANCIAL_CRON_SECRET` protects the refund/reversal runner.
- `CJ_AUTOMATIC_FULFILLMENT_ENABLED` remains false unless deliberately enabled.
- Railway startup runs `npx prisma migrate deploy && npm run start`.

No production data, inventory, Stripe charge/refund/transfer/reversal, secrets, or CJ supplier order is used by Stage 5.
