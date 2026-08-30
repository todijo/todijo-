# Phase 9 stages 2–6: Android TWA release notes

## Architecture and security findings

Todijo continues to use the production HTTPS origin inside a Trusted Web Activity. Authentication remains the existing HTTP-only, production-secure, SameSite=Lax session cookie. Every session read revalidates the user, auth version, block state and deactivation state. Google, Facebook and Apple remain redirect OAuth flows with signed, expiring state; no WebView, bearer-token, custom-scheme, provider-secret or native payment implementation was added.

OAuth success and recoverable provider failures now preserve the validated locale and internal `next` route. Invalid or mismatched state fails closed. Stripe Checkout success and cancellation URLs now use localized HTTPS Todijo routes so verified Android App Links can return to the TWA. The webhook and persisted order state remain payment authority; the success page continues to show a processing/verification state until payment is authoritative.

Catalog, search, product, image, account, order and tracking implementations were audited rather than duplicated. Existing responsive layouts, incremental catalog loading, canonical localized product sharing, public-image-only caching and safe known-carrier adapters remain in place. Private order pages query by the authenticated buyer. Arbitrary seller tracking URLs are not rendered.

Favorites and cart data are stored in separate guest/user local-storage namespaces. This prevents account switching from showing another user's state and survives a TWA process restart. Account synchronization would require new durable relations and is intentionally not introduced in this release.

## Push boundary

The service worker now supports conservative notification rendering and allowlisted localized HTTPS click destinations. It ignores server-supplied lock-screen text and accepts only a category plus an allowlisted route. It does not request notification permission automatically.

Sending Web Push is disabled because the current schema has no durable PushSubscription/device model. The minimal future migration is:

- `PushSubscription`: `id`, `userId`, unique `endpoint`, encrypted `p256dh`, encrypted `auth`, `expirationTime`, `userAgent`, `createdAt`, `updatedAt`, `lastUsedAt`, `disabledAt`.
- relation to `User` with `onDelete: Cascade`.
- indexes on `(userId, disabledAt)` and `(disabledAt, updatedAt)`; the endpoint must be unique.
- no historical backfill; rows are created only after an authenticated, explicit permission action.
- deletion on account deletion or explicit device unsubscribe; expired/410 endpoints are disabled then periodically removed.
- rollback disables subscription APIs and delivery first, then drops the table; in-app `Notification` records remain authoritative and unaffected.

Keys must be encrypted with a server-only key. VAPID credentials are a new secret/provider configuration and were not added. Until migration and credentials are explicitly approved, there is no subscribe API or server delivery path.

## Offline and Android behavior

Commerce, authentication, account, orders, tracking, messages, notifications, cart and checkout remain excluded from service-worker caching. Offline navigation uses only the localized non-authoritative offline page. Android App Links cover the HTTPS origin, including product, search/category, cart, authentication returns, Stripe returns, orders, tracking and messages. API 36 predictive-back handling is explicitly enabled, while the existing transparent system bars and `adjustResize` keyboard behavior remain.

Stage 7 still requires the real Play signing certificate fingerprint, production `assetlinks.json`, signing configuration, an API 36 release AAB, device/TWA verification, Play Console internal testing and the later publication decision.
