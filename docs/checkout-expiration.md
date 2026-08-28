# Checkout expiration lifecycle

Todijo keeps checkout-initiated orders as diagnostic records; it never hard-deletes abandoned attempts. Stripe Checkout Sessions expire after 24 hours by default. Todijo waits 25 hours before the maintenance runner considers a legacy or locally timed attempt, leaving a one-hour safety margin.

The existing `POST /api/internal/refund-financials` runner also processes at most 50 due checkout attempts per run. For an order with a Stripe Session it retrieves Stripe authoritatively and changes the order only when the Session is `expired` and unpaid. Open, complete, paid, unavailable, or mismatched Stripe responses fail closed and remain retryable. A checkout with no created Stripe Session can expire after the same grace period.

The `checkout.session.expired` webhook performs the same guarded transition immediately. Both paths require the order to remain `PENDING`, with no `paidAt`, PaymentIntent, shipment, delivery, or prior expiration. The transition is idempotent, sets `CANCELLED` plus `checkoutExpiredAt`, and records a `CHECKOUT_EXPIRED` lifecycle event.

Production operations should keep the existing refund-financial runner scheduled and ensure the live Stripe webhook subscribes to `checkout.session.expired` in addition to payment-completion events.
