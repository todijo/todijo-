# Phase 7 security, parity, and performance review

## Trust and abuse boundaries

Authentication rate limits no longer accept public forwarding headers; `phase7-proxy-trust.md` records the required private-ingress secret and Traefik behavior. Native bearer requests without browser origin headers reach their route handler, where session and role checks remain authoritative; browser cross-site mutation requests remain rejected. Seller media writes require a fresh seller role, live store ownership, bounded multipart payload, validated/sanitized media, and a server-generated non-overwriting key. The public unsigned Cloudinary preset must be disabled separately at the provider.

Web Push endpoints are limited to known browser push-service hostnames at registration and again immediately before delivery, including previously stored subscriptions. Adding another legitimate browser push service requires an explicit reviewed hostname addition; arbitrary HTTPS endpoints are not accepted. Supplier video fetches accept only CJ-controlled HTTPS hosts, disallow redirects, and cap streamed bytes. Supplier image URLs are passed to Cloudinary's server-side upload API only after the same host check; Todijo does not fetch them locally.

Existing server tests exercise buyer/seller ownership, admin role checks, price/stock authority, checkout return non-authority, webhook replay/idempotency, refunds, and CJ permission boundaries. This code-level review is not a penetration test or evidence of live provider readiness.

## Web and Flutter parity limit

The full backend and Flutter suites cover the shared API contracts and responsive widgets. Both web and Android production builds pass against the current source. This does not certify an authenticated end-to-end walkthrough for Buyer, Seller, and Admin across desktop web, responsive web, Android, and iOS: live authorized accounts, physical Android verification, and macOS/Xcode iOS verification remain external tasks. Do not treat a source/build pass as that runtime certification.

## Performance

The mobile admin dashboard previously fetched every store and access grant solely to count active stores. It now uses database counts with the same active-access predicate. The marketplace store list has a short public cache. The buyer order list and seller dashboard still load complete order histories with relations/analytics; their payload and query costs should be measured against representative production-sized data before high-volume launch. A contract-preserving pagination/aggregate change needs measured thresholds and client coordination, not a speculative data truncation. CJ pricing/freight and loyalty remain server-authoritative; no supplier-call caching was introduced that could return stale checkout prices.
