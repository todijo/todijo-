# Phase 9 Stage 1 PWA/TWA QA

Record browser synthetic, emulator, and physical-device results separately.
Never report browser timings as native Android timings. Record SHA, Chrome
version, device/API, memory tier, network profile, cache state, locale,
viewport, and three repetitions.

Measure cold and repeat launch, initial render, scroll through 72 products,
home-to-product interaction, image completion and layout shift. Browser
viewports are 390x844 and 320x720 with normal, Slow 4G and offline profiles.
Watch long tasks, heap growth, failed images, layout shift and retained DOM.

English, French and Arabic offline pages are precached. Navigation is network
first. API, checkout, account, cart, orders, messages, seller/admin and auth
routes bypass caching. Retry performs a normal authoritative navigation.

Catalog listing already uses 24-product mobile batches and responsive sizes.
External product media is deliberately not service-worker cached. Same-origin
public images and branding are cached. Unoptimized supplier imagery remains a
real-device measurement risk before changing source-media semantics.

Verify CSP framing/base/object restrictions, DENY framing, nosniff, strict
origin referrers and Permissions Policy. Smoke test Stripe and all OAuth browser
redirects before production.
