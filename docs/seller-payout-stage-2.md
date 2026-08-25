# Seller payout Stage 2

## Audit result

Stage 2 was partially implemented before this follow-up. The existing `OrderGroup` model already provided seller-scoped immutable amounts, maturity evidence, shipment and eligibility timestamps, transfer state, retry fields, and unique Stripe/idempotency references. `lib/seller-maturity.ts` already classified `STANDARD`, `NEW`, and `HIGH_RISK` sellers, and `lib/seller-transfers.ts` already contained transfer submission with current Connect-account retrieval. Those services were not connected to fulfillment or a durable runner, and high-risk release had no authorized audit path.

## Enforced lifecycle

- Buyer payment creates no seller transfer. Marketplace groups remain `WAITING_FOR_SHIPMENT`.
- The authenticated, ownership-checked, serializable seller fulfillment transition to `SHIPPED` is the authoritative marketplace shipment event available in Todijo. That server transition marks only the authenticated seller's `MARKETPLACE` group; repeated transitions do not move the timestamp.
- `STANDARD`: verified shipment records `shipmentVerifiedAt`, sets `transferEligibleAt` to the same timestamp, and moves the group to `READY`.
- `NEW`: verified shipment persists `transferEligibleAt = shipmentVerifiedAt + 7 days` and `RESERVE_PERIOD`. The durable internal runner promotes it only when the database timestamp is due.
- `HIGH_RISK`: verified shipment moves to `MANUAL_ACTION_REQUIRED` with no eligibility timestamp. A database-authorized admin must provide a reason to release it. The serializable compare-and-set update is idempotent and writes `SELLER_TRANSFER_RISK_RELEASED` to the order lifecycle audit.
- `CJ_PLATFORM` groups cannot be marked by the marketplace shipment function, selected by the runner, claimed by transfer execution, or sent to Stripe.

The internal runner is `POST /api/internal/seller-transfers` and requires a timing-safe `Bearer` comparison against `SELLER_TRANSFER_CRON_SECRET`. It promotes due reserves and processes due `READY`/`RETRYABLE` groups. Deployment must schedule this endpoint; the request does not need to remain open after an individual seller shipment.

## Transfer safety

Execution uses a database compare-and-set claim to `SUBMITTING`, the unique persisted `transferIdempotencyKey`, and Stripe idempotency. It submits the immutable `sellerNetAmountMinor` and order currency. Immediately before submission it requires an active store and a non-suspended, non-deactivated, non-blocked owner, retrieves the exact current Connect account through the platform key, and requires complete Connect readiness. Failures become retryable with a durable next-attempt timestamp; a stored unique Stripe transfer ID prevents completed transfers from being selected again.

The compare-and-set claim persists its lease expiry in the existing indexed `nextTransferAttemptAt` field. The runner does not touch a fresh claim. A `SUBMITTING` marketplace claim is moved to `RETRYABLE` only when that centralized 15-minute lease has expired, then it is reclaimed through the same database compare-and-set path. Fifteen minutes is deliberately conservative for the worker's single Stripe request and matches the existing failed-attempt retry interval. Recovery never changes `transferIdempotencyKey`, so a transfer accepted by Stripe before a process crash resolves through the original Stripe idempotency record rather than creating another logical payment.

No historical rows are backfilled or promoted by a migration in this stage. There is no schema migration and no production or Stripe data write in deployment itself.
