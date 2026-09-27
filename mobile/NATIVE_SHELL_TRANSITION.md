# Todijo native-shell transition inventory

The responsive website is the sole Buyer, Seller, and Admin business UI. The
current Flutter business screens remain in source as a preservation measure;
`lib/main.dart` no longer starts them. They must not be deleted before the
equivalent real WebView flows and native integrations pass runtime review.

| Decision | Existing code | Reason |
| --- | --- | --- |
| KEEP | `lib/src/core/config`, `lib/src/core/auth/secure_session_store.dart`, connectivity, app links, native permissions, Android/iOS app metadata | Native infrastructure; secure storage may be required for a server-backed handoff, but legacy bearer credentials are not WebView cookies. |
| KEEP | `lib/src/features/notifications/push_registration.dart`, native file/camera helpers | Potential native integrations; push provider/token lifecycle still needs verification. |
| DEPRECATE | `lib/src/features/marketplace`, `auth`, `account`, `seller`, `admin`, `content` presentation screens and `lib/src/app.dart` router | Duplicate responsive-web business UI, currently retained for comparison and rollback. |
| REMOVE LATER | Unused business-screen widgets, repositories, and duplicate tests after Buyer/Seller/Admin WebView verification | No removal until the native shell and all required website flows are proven. |

## Verified boundary and outstanding work

The shell loads only the configured Todijo origin as its main frame. Other
HTTPS pages, mail, and phone links leave the app. It has no JavaScript channel
and never exposes native secrets to page scripts. Server authentication and
authorization remain authoritative. A native bearer session from the old UI
is **not** treated as a WebView cookie session.

The existing web OAuth callback creates a cookie in the browser that started
OAuth. That cookie is not copied into WebView. The shell now intercepts web
social-start links, creates a server OAuth attempt, and opens the provider in
the system browser. Its native-held 256-bit handoff verifier is retained only
in secure storage while the attempt is pending. The server stores only its
SHA-256 hash as the attempt ID. After the provider callback returns through
`todijo://auth/oauth`, the shell POSTs the code, state, and native-held
verifier to a one-time server endpoint *inside WebView*. The server consumes
the same provider-validated attempt and sets the normal HttpOnly web cookie;
it does not issue a mobile bearer session. A disposable-DB HTTP test verifies
cookie issuance and replay rejection. Actual Google/Apple/Facebook runtime
completion remains unverified without configured local provider credentials
and callback URLs. Stripe external return and logout cookie/native-token
coordination also need real runtime verification.

The disposable Android alias `http://10.0.2.2:<port>` is admitted for unsafe
same-origin web requests only when Next is in non-production mode and the
server's own request URL is HTTP loopback on that exact port. Cross-site and
forged origins remain rejected; production has no such alias.

No push provider credentials, Seller/Admin local session, iOS/Xcode runtime,
or physical device verification is implied by this inventory. The old Flutter
screens remain available in Git; they are not active app screens.

Android release packaging now refuses the previous debug-key fallback. A
store-signed build requires external `TODIJO_ANDROID_KEYSTORE_PATH`,
`TODIJO_ANDROID_STORE_PASSWORD`, `TODIJO_ANDROID_KEY_ALIAS`, and
`TODIJO_ANDROID_KEY_PASSWORD` values; none are stored in this repository.
`flutter build apk --debug` remains available for disposable review.

The preserved push coordinator is not yet wired to the WebView shell. The
server now offers a narrow cookie-session-bound WebView registration route,
sharing the same encrypted, user-owned device write path as the legacy bearer
route. Native FCM/APNs provider configuration and a real token source are
still required before claiming push delivery, rotation, or logout revocation
in this architecture.
