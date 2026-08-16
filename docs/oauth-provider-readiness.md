# Todijo OAuth provider readiness

Status: **CODE READY / LEGAL AND PUBLIC PAGES READY / PROVIDER CONFIGURATION PENDING**.

This runbook contains identifiers and URLs only. Never commit client secrets, private keys, access tokens, authorization codes, or real provider credentials. Missing provider configuration is expected to fail closed: its sign-in control remains disabled and email/password authentication remains available.

Production public URLs:

- Homepage: `https://todijo.com/`
- Privacy policy: `https://todijo.com/en/info/privacy`
- Terms: `https://todijo.com/en/info/terms`
- Data deletion instructions: `https://todijo.com/en/info/data-deletion`
- Contact/support: `https://todijo.com/en/info/contact`

Localized equivalents use the same path after the locale segment.

## Google

- Authorized domain: `todijo.com`
- Callback: `https://todijo.com/api/auth/social/google/callback`
- Required environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Requested scope: `openid email profile`
- Still required manually: verify the domain (including the applicable Search Console verification), configure the Google Cloud OAuth consent/branding screen and authorized redirect URI, supply real credentials in the deployment secret store, then test the production flow safely.
- Todijo does not request Gmail, Drive, Calendar, Contacts, or other unrelated Google scopes.

## Apple

- Registered web domain: `todijo.com`
- Return URL: `https://todijo.com/api/auth/social/apple/callback`
- Required environment variables for the current runtime interface: `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`
- Still required manually: configure the domain and Services ID in Apple Developer, create and rotate the signed client secret using Apple-approved private-key material outside the repository, register the return URL, supply the runtime values, then test relay/private-email behavior safely.
- Apple relay email addresses must remain accepted as valid identities.

## Facebook / Meta

- App Domains value: `todijo.com`
- Homepage: `https://todijo.com/`
- Privacy policy: `https://todijo.com/en/info/privacy`
- Terms: `https://todijo.com/en/info/terms`
- Data Deletion Instructions URL: `https://todijo.com/en/info/data-deletion`
- Valid OAuth redirect URI: `https://todijo.com/api/auth/social/facebook/callback`
- Required environment variables: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
- Expected minimum permissions: `email`, `public_profile`
- Still required manually: create/configure the Meta app, set App Domains and HTTPS URLs, configure Facebook Login and the exact redirect URI, enter the privacy/terms/data-deletion URLs, keep development and live modes separate, complete any required business verification or App Review, supply secrets through the deployment secret store, then test with approved accounts before enabling live access.
- Todijo does not request Facebook posts, friends, messages, photos, or advertising data.

## Activation checklist

1. Complete the provider-side domain, branding, consent, application, and review steps.
2. Store real credentials only in the production secret manager; never in source control or `.env.local` for this task.
3. Confirm the public homepage, Privacy Policy, Terms, support, and data-deletion URLs return successfully over HTTPS without authentication.
4. Confirm callback URLs match exactly, including scheme, host, path, and absence of an unintended locale prefix.
5. Validate state checking, provider identity, verified-email/linking rules, role preservation, DB-backed sessions, and final-authentication-method protections in a controlled environment.
6. Only after a real end-to-end provider test may that provider be described as **PRODUCTION VERIFIED**.
