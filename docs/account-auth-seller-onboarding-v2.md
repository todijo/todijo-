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

## Seller onboarding

/{locale}/seller/onboarding is resumable from persisted Store fields and preserves the same User.id. Private sellers do not need a business registration number, including in France. Professional French sellers receive the SIRET label and a format-only 14-digit check; this is not government verification. Other countries use a generic business-registration identifier. VAT declaration is separate from verification.

Submission creates a PENDING store only when needed and records PENDING_REVIEW. It never grants admin, verification, subscription, Stripe Connect completion or dropshipping access. Admin review data is visible at /adm-barewbar-182203/seller-review under the existing database-authorized admin guard.

## Operations and future security

No production migration or environment change is performed by this implementation. Apply the checked migration through the normal deployment migration path only after a fresh backup. Two-factor authentication is not implemented; AccountSecurityEvent and authVersion are extension points. Admin 2FA should be prioritized in a later, separately reviewed task.
