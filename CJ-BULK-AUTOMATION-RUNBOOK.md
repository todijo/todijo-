# CJ Bulk Import + Automatic Sync

## Catalog discovery and resumable bulk import

The hidden supplier admin workspace can search the CJ catalog in bounded pages of 20 and create a persisted import job containing up to 500 exact CJ product IDs/SKUs. Each processing request claims at most 10 items (default 3), runs sequentially through the existing authoritative importer, and can be resumed after a refresh or timeout. Per-item imported, skipped, quarantined and failed results are retained without secrets.

Every imported product is created as a private `DRAFT`; nothing is auto-published. A stable canonical Todijo leaf category is mandatory. Unmapped, restricted, invalid-freight or invalid-FX items remain quarantined for administrator review.

## Automatic sync

Production exposes a server-only endpoint:

`POST /api/internal/supplier-sync`

It requires `Authorization: Bearer <SUPPLIER_SYNC_CRON_SECRET>`. It never accepts the secret from browser code. Each run processes up to 20 stale platform-owned CJ products, one at a time, with an inter-product delay. Products are considered stale after six hours; error/unavailable/price-changed links are eligible immediately.

### Coolify setup

1. Generate a long random secret and add it to the Todijo production environment as `SUPPLIER_SYNC_CRON_SECRET`.
2. Redeploy so the environment variable is available to the application.
3. Create a Coolify Scheduled Task that runs hourly and POSTs to the endpoint with the Bearer secret. Example shell command (replace the placeholder from the server environment; do not hard-code the real secret in source control):

```sh
curl --fail --silent --show-error --request POST \
  --header "Authorization: Bearer $SUPPLIER_SYNC_CRON_SECRET" \
  https://todijo.com/api/internal/supplier-sync
```

Recommended cadence: hourly. The endpoint itself only selects stale products, so this does not resync every product every hour.

The same operation is available to a signed-in database-verified administrator in the catalog workspace. Do not configure the browser/admin endpoint as a scheduler; only the server-secret `/api/internal/supplier-sync` endpoint is suitable for Coolify.

## Safety invariants

- CJ imports stay draft-only until reviewed.
- Existing canonical `ProductVariant` supplier identities are preserved by the normal sync pipeline.
- Automatic sync is currently restricted to the platform-owned CJ connection. Seller-owned supplier connections are not silently routed through platform credentials.
- No automatic CJ fulfillment setting is changed by this feature.
- Keep `CJ_AUTOMATIC_FULFILLMENT_ENABLED=false`. Catalog import and synchronization never call an order, payment, or fulfillment endpoint.
- Checkout remains authoritative for destination, freight, verified FX, and final buyer price.
