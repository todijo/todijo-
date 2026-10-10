# Todijo account, authentication and seller onboarding V2

## Compatibility contract

The migration is additive and forward-only. It does not delete or rewrite users, roles, stores, orders, Stripe identifiers, supplier permissions or password hashes. Existing password hashes remain bcrypt-compatible. New profile fields are nullable; onboarding fields have conservative defaults. Existing sellers are not blocked by NOT_STARTED.

Todijo keeps one User identity. A buyer-to-seller upgrade updates that same user and creates a store only when none exists. An existing store is updated in place. Admin users are explicitly rejected from seller upgrade and admin authorization continues to read the current database role.

## Email/password

Registration and login remain available without any social provider. Passwords use bcrypt cost 12 with a minimum of 10 characters for new/reset credentials. Email verification and password reset use random one-time tokens; only SHA-256 hashes are stored. Reset and change-password operations increment authVersion, invalidating older JWT sessions without changing roles.

Profile, password and verified email-change controls live at /{locale}/account. Historical order-address snapshots are never rewritten.

## Social providers: code-ready, configuration-pending

Provider buttons are disabled until every required value is present. Never place values in source control.

| Provider | Required environment variables | Callback URL |
| --- | --- | --- |
| Google | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | https://TODIJO_ORIGIN/api/auth/social/google/callback |
| Apple | APPLE_CLIENT_ID, APPLE_CLIENT_SECRET | https://TODIJO_ORIGIN/api/auth/social/apple/callback |
| Facebook | FACEBOOK_APP_ID, FACEBOOK_APP_SECRET | https://TODIJO_ORIGIN/api/auth/social/facebook/callback |

APP_URL must be the public HTTPS Todijo origin and SESSION_SECRET must remain at least 32 characters. Google requires an OAuth web client and authorized redirect URI. Apple requires a Services ID, verified domain/return URL, and a client-secret JWT generated and rotated outside Todijo. Facebook requires a Login product, valid OAuth redirect URI and approved email permission as applicable.

OAuth state is HMAC-protected and expires after ten minutes. Access/refresh tokens are neither persisted nor logged. A known provider subject signs into its linked user. A verified provider email can link to the matching user; an unverified/missing email cannot silently link or create an account. Facebook email is treated as unverified and therefore requires an already-linked provider identity or an authenticated explicit link. No provider may assign roles.

Provider-side application creation, consent-screen review, domain verification, credentials and safe production smoke tests remain required. Status remains CODE-READY / CONFIGURATION-PENDING until those steps are complete.

## Seller onboarding and verification

/{locale}/seller/onboarding is a resumable, four-step flow backed by the seller onboarding draft and Store fields; it preserves the same User.id and reuses saved buyer profile/address data when available. Private sellers do not need professional registration identifiers, including in France. French professional sellers provide the SellerBusiness SIREN and an establishment SIRET. Todijo validates their length/check digits, confirms the SIRET-to-SIREN relationship, and checks the legal unit and establishment against the official INSEE Sirene API. Restricted or incomplete public data and temporary upstream failures remain distinguishable from invalid/not-found identifiers. Professional sellers elsewhere provide the registration details required for their country. VAT declaration remains separate from business verification.

Completed ordinary onboarding activates the store without redundant Admin approval once its applicable identity/legal and verification checks pass. The exceptional INSEE manual-review path may leave a store PENDING with PENDING_REVIEW; only those reviewable cases enter the database-authorized Admin queue at /adm-barewbar-182203/seller-review. Seller onboarding does not grant Admin privileges, paid subscription entitlement, Stripe Connect readiness or supplier/dropshipping access. FREE sellers do not require a paid subscription; any applicable payment setup/readiness remains a separate gate.

## Operations and future security

No production migration or environment change is performed by this implementation. Apply the checked migration through the normal deployment migration path only after a fresh backup. Two-factor authentication is not implemented; AccountSecurityEvent and authVersion are extension points. Admin 2FA should be prioritized in a later, separately reviewed task.
