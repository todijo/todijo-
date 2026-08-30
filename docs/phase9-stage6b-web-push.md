# Phase 9 Stage 6B — durable Web Push

## Production configuration

Generate VAPID keys locally without printing them in CI logs:

```powershell
npx web-push generate-vapid-keys --json
```

Generate the independent 32-byte subscription encryption key:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"
```

Store the resulting values only in Coolify secrets:

- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT` (`mailto:` address or HTTPS URL)
- `WEB_PUSH_ENCRYPTION_KEY` (base64-encoded 32 bytes)

The application builds and runs normally when any value is absent or invalid. The authenticated configuration endpoint then returns `{ available: false }`, the UI does not request permission, and delivery is skipped.

## Deployment

Run the normal additive migration during deployment:

```powershell
npx prisma migrate deploy
```

Then deploy the merged application. No backfill is required. Existing in-app notifications remain authoritative.

## Security and lifecycle

Endpoints are represented by a SHA-256 lookup identity and AES-256-GCM encrypted value. Browser `p256dh` and `auth` material is also AES-256-GCM encrypted with the server-only encryption key. APIs never accept a user ID and never return stored endpoint/key material. One endpoint cannot move between users; the prior owner must revoke it first. User deletion cascades subscription deletion.

Each in-app Notification row has a nullable `pushDispatchedAt` claim used to prevent obvious retry duplicates. Push is claimed and dispatched only after the authoritative transaction commits. Delivery uses at most five concurrent devices. HTTP 404/410 responses revoke the endpoint; other failures increment a bounded diagnostic counter and are not retried in a loop. Provider errors are reduced to error class names and endpoints/key material are never logged.

Current event integration covers authoritative paid orders, seller-confirmed shipped/delivered transitions, and persisted marketplace messages. Refund and return categories are allowlisted for future authoritative hooks; no fabricated event is emitted.
