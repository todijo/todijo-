# Phase 6 loyalty accounting — implementation boundary

This is a working design record, not a launch approval or French accounting certification.

The existing checkout resolves product/variant prices, CJ supplier quotes, FX,
shipping and `OrderGroup` seller allocations in `lib/payments.ts`. Stripe Checkout
sessions and webhooks are also created/processed there. Seller transfers use
`OrderGroup.sellerNetAmountMinor` in `lib/seller-transfers.ts`; refund allocation
uses that same snapshot in `lib/refund-lifecycle.ts`. Loyalty must be integrated
at those authorities, not priced or paid from web/Flutter clients.

The additive Phase 6 schema starts disabled. Existing stores and products are
opted out by default. No existing order or payout is retroactively changed.
Positive audited Admin adjustments are funded by Todijo/platform, not by the
selected seller. They receive a separate `PLATFORM_ADMIN` grant source and an
append-only platform funding pledge keyed by a unique treasury reference.
That pledge alone is not spendable and is not reported as funded cash. A
different Admin must attest an external finance journal/bank evidence reference
in a second append-only record before the grant becomes available. This is an
internal treasury control, not a claim of segregated Stripe funds or escrow.
Seller reserve and platform-funded credit are reported separately; the latter
must never be inferred from a seller sale or booked as commission revenue.
The selected store is a redemption restriction, not the funding party.
Normal product-earned grants are always `SELLER_RESERVE`: their issuing order
group snapshots a reserve deducted from that seller's payable. Every monetary
ledger entry must point to a funding-typed grant. Redemption allocations keep
the source grant, so seller-funded and platform-funded spending can be
reconciled separately even when they share the same buyer/store account.
The seller-facing report projects only seller-funded outstanding, redeemed and
expired credit; Admin sees both buckets and any source-attribution discrepancy.
The store/order funding trace derives source-specific redemption and restoration
from immutable grant allocations. It checks that buyer cash plus both funding
sources equal merchandise plus shipping, that commission is based on newly
paid merchandise, and that seller payable deducts only new seller-earned
reserve. Unpaid/pending orders are explicitly unverified; the trace never
pretends a provider payment succeeded. Seller lookup is scoped to the
authenticated seller's own store.
An Admin goodwill adjustment requires an explicit `PLATFORM_ADMIN` source.
It must never be used to repair a missing seller-funded historical earning.
The separate `SELLER_REPAIR` admin action accepts only an original paid order
item with a missing grant, validates that its order group already deducted the
entire snapshotted seller reserve from payable, rejects refund ambiguity, and
creates an audited seller-sourced grant idempotently. It does not increase the
seller reserve or backdate a platform promotion. Operational platform cash
funding and settlement still require proof before global enablement.
Each customer/store account has one currency bucket; v1 buyer-facing credit
is EUR. No cross-store transfer, gifting, cash withdrawal or seller rate is
permitted. `LoyaltyLedgerEntry` is append-only by database trigger. Unique event
references must make webhook/refund retries idempotent. A negative signed
ledger balance represents an owed amount after a late refund; it is never
silently clamped in reconciliation, although spendable credit is clamped to 0.

Seller opt-out stops future earning; funded existing credit remains redeemable
against otherwise eligible non-CJ merchandise from that same store. A platform
admin block additionally prevents new earning, without deleting obligations.
No credit can pay shipping. The quote calculates commissionable merchandise
on newly paid merchandise only, excluding redeemed reserve. The reserve must
be deducted from seller payable once, recorded as a liability rather than
Todijo revenue, and released or reversed only through auditable events.

Before any endpoint may accept redemption, checkout must transactionally lock
the buyer/store loyalty account, re-read available ledger and active
reservations, persist a unique checkout reservation, allocate redemption to
eligible lines of that store, and make Stripe's payable total match the
server-side order evidence. Webhook payment confirmation must consume that
reservation exactly once. Canceled/expired checkout must release it. A mobile
return URL is never payment proof. Full/partial refunds must append reversal
and restoration events and reconcile `OrderGroup` reserve and seller transfers.
An ACTIVE reservation remains a hold even after its local timestamp passes:
only verified provider payment/cancellation/expiration evidence may consume or
release it. This favors safety over availability if a provider callback is
delayed; an authenticated reconciliation job must resolve stale holds.

The present code snapshots EUR earning and seller reserve in checkout, records
pending grants after verified cash payment, releases unrefunded pending credit at
verified delivery, sends one warning before a still-unspent grant expires,
and appends proportional earning reversals only after a confirmed refund.
The account-locked reservation primitive rejects cross-buyer/store access,
insufficient funds, overlapping device holds, and changed-request replays. A
paid-order consumption primitive allocates the spend to earliest-expiring
grants per order item. `LoyaltyRedemptionAllocation` keeps immutable original
grant/item funding attribution and a separate restored amount for confirmed
partial refunds, making later per-grant expiry auditable. A verified paid Stripe
webhook consumes a partial-cash order's hold; the explicit server-side zero-cash
path consumes a fully funded order's hold. Confirmed refund finalization calls
the restoration primitive for orders with redeemed credit. Verified Checkout
expiration/cancellation releases a pending hold only when the pending order
actually transitions to cancelled; a late expiration cannot release a paid
order's hold. An individual failed PaymentIntent attempt is not Checkout
finality and does not release the hold while the buyer may retry; an expired
or asynchronously failed Checkout Session must match its stored session ID.
A production treasury and reserve-funding audit is still required.
Global enablement is deliberately closed by default. The buyer summary's expiring-soon projection
assumes that future redemption entries are allocated to their source grants
(earliest expiry first); account-level unallocated redemption is not safe.
The per-line redemption allocator splits exact minor units for quantity/partial
redemption without discounting CJ or shipping. A fully loyalty-funded order
does not create a zero-total Stripe Checkout Session or PaymentIntent; it uses
an atomic server-paid path that rechecks the order, stock, held credit and
funding snapshot before consuming the hold once. A partially funded order
asks Stripe only for new cash and requires the verified paid webhook to match
that amount before consuming credit.
Stripe Checkout may report `no_payment_required` for a completed session; it
is not interchangeable with this application's existing `paid` webhook
invariant. The seller settlement calculation distinguishes previously funded
redeemed merchandise from newly paid commissionable merchandise, while keeping
shipping and the new loyalty reserve separate. Checkout persists this
composition. The
existing Connect separate-transfer path draws from the platform balance;
the reserved loyalty liability cannot be treated as platform commission or
assumed to be present without reconciliation.
Seller/admin accounting endpoints and guarded web/Flutter administration
screens expose store-level and platform-wide reserve/grant drift rather than
silently masking it.
The optional seller `orderId` accounting lookup is restricted to the
authenticated seller's store. Admin order lookups additionally compare the
saved checkout funding snapshot with the sum of every order group, including
new cash, seller payable, commission and new reserve. A group-level trace
compares redeemed/restored allocations by grant funding source and flags
unbalanced paid settlement, full-refund recovery and cash-only commission or
reserve violations. These read-only diagnostics do not move money or prove a
Stripe transfer occurred; provider/treasury evidence remains a separate
release requirement.
Attested platform funding records are reconciled to spendable platform grants;
unattested pledges are reconciled to pending grant events separately. An audited
debit can revoke only unspent platform credit, never a seller-funded grant.
An unattested pledge that never receives treasury backing can instead be
cancelled: its grant becomes reversed and an immutable pending-reversal event
records the cancelling admin and reason. It never becomes buyer-spendable or
seller-funded. The admin pending-pledge total excludes cancelled pledges but
the original pledge and cancellation remain in the ledger.
Actual platform cash backing and seller-settlement liquidity must be verified
before the program can be enabled. Reports show positive customer liabilities and negative
customer-owed balances separately; one buyer's debt never erases another
buyer's spendable liability in the report. Date-filtered event pages are
flows, while reserve and balance figures are all-time snapshots. Production
rollout must remain disabled until
all settlement/Stripe/refund invariants above are implemented and tested.
The web/Flutter admin controls can change future rate/expiry limits with an
audited reason and can block a seller's future participation. Global activation
is a separate high-risk action. It is rejected unless deployment operators
explicitly set `LOYALTY_ACTIVATION_ALLOWED=true` and provide distinct valid
`LOYALTY_ACTIVATION_RELEASE_REFERENCE`,
`LOYALTY_TREASURY_APPROVAL_REFERENCE`, and
`LOYALTY_SETTLEMENT_APPROVAL_REFERENCE`. The Admin must type the matching
release reference and `ENABLE_LOYALTY`, provide a substantial reason, and
the server must find the loyalty ledger reconciled in the same transaction.
An activation release reference already used for a previous launch cannot
be reused after a pause; operators must provide a fresh approved reference.
The change records Admin identity, timestamp, old/new state and all three
operational references. Pausing requires `DISABLE_LOYALTY` and a reason.
These configuration references are human approval evidence, **not** machine
proof that Stripe cash is segregated or that treasury funding exists. No
production activation or operational approval was performed in Phase 6.
Manual Admin actions are separately confirmed: platform pledge, independent
treasury attestation, pending-pledge cancellation, unspent platform debit,
and verified seller-reserve history repair. Each route rechecks database Admin
role and appends immutable funding/ledger evidence; an Admin UI success cannot
override server-side source or treasury rules.
After an audited first activation, later disabling future earning does not
erase previously earned customer credit: checkout may still redeem an
unexpired attributed grant, while no new loyalty reserve is created. A fresh
installation with no activation history remains closed to redemption, even
if a stray grant record exists. The checkout preview exposes earning and
redemption availability separately to web and Flutter.

French accounting and tax treatment must be validated by a qualified
expert-comptable before production launch. In particular, VAT treatment,
breakage/expiry recognition, FX conversion, and settlement presentation must
not be inferred from this code alone.
