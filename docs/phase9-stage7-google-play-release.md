# Phase 9 Stage 7 — Google Play Internal Testing runbook

Status: repository preparation complete; release is blocked on owner-controlled
Play Console/signing inputs and an Android toolchain. This is not authorization
for a public or Production-track release.

## Immutable release identity and shell

| Setting | Value |
| --- | --- |
| Application ID | `com.todijo.marketplace` |
| Compile / target / minimum SDK | 36 / 36 / 23 |
| Initial version | code `1`, name `1.0.0` |
| TWA origin and scope | `https://todijo.com`, all paths |
| Start URL | `https://todijo.com/en?source=twa` |
| Launcher | Android Browser Helper `LauncherActivity` |

The application ID becomes permanent when the Play app is created. The manifest
contains one verified HTTPS origin with `/` as the maximum scope. It therefore
covers localized home, category/search, canonical product, cart, login and OAuth
return, checkout success/cancel, order detail/tracking, notifications and messages.
Stripe, identity providers and carriers are external origins and stay browser UI.
There is no WebView, insecure custom scheme, cleartext opt-in or Play Billing.

The API 36 shell opts into predictive back. Transparent system bars, the
Android 12+ splash theme, unrestricted sensor-based orientation, adaptive and
legacy launcher icons, RTL support and `adjustResize` are already configured.
Edge-to-edge, cutouts, IME overlap and back behavior still require the device
matrix below; configuration alone is not a result.

## Signing and Digital Asset Links boundary

Play App Signing uses two different keys:

- The owner keeps the **upload key** and signs the AAB sent to Play. It proves
  uploader identity and is resettable through Play.
- Google keeps the **app signing key** and signs APKs installed by Play users.
  Its certificate SHA-256—not a debug or upload fingerprint—belongs in the
  production Digital Asset Links file.

The repository intentionally serves `[]` at
`https://todijo.com/.well-known/assetlinks.json`. This fails visibly as a Custom
Tab and prevents false trust. After creating the app and enabling Play App
Signing, copy the SHA-256 from **Play Console → select Todijo → Test and release
(or Protected with Play) → Setup / App integrity → App signing → App signing key
certificate**. Console labels can move; choose *App signing key certificate*,
not *Upload key certificate*. Publish exactly:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.todijo.marketplace",
      "sha256_cert_fingerprints": ["REAL_PLAY_APP_SIGNING_SHA256"]
    }
  }
]
```

Never substitute a made-up value. Once supplied, update
`public/.well-known/assetlinks.json`, redeploy the web app, and verify HTTP 200,
JSON content type, no redirect, exact package, and uppercase colon-delimited
fingerprint. This public fingerprint is not a private key.

## Upload key and release bundle

This workstation audit found no JDK, Android SDK, ADB, Gradle, Gradle wrapper or
existing upload keystore. On an owner-controlled machine install JDK 17, Android
SDK Platform/API 36, Build Tools 36.0.0 and Gradle 9.1.0. Create an upload key in
Android Studio or with `keytool`, entering passwords interactively; do not place
passwords on a shared command line or in logs. Back up the keystore and passwords
in separate access-controlled stores. Export only its public certificate if Play
asks for it.

Set these in the private Gradle user properties file or process environment:
`TODIJO_UPLOAD_STORE_FILE`, `TODIJO_UPLOAD_STORE_PASSWORD`,
`TODIJO_UPLOAD_KEY_ALIAS`, `TODIJO_UPLOAD_KEY_PASSWORD`. Then run from `android`:

```text
gradle :app:bundleRelease
```

The task fails if any signing value is absent. Expected output:
`android/app/build/outputs/bundle/release/app-release.aab`. Confirm package,
version, target SDK, release certificate, no debuggable flag, and no cleartext
permission with Android Studio APK Analyzer or `bundletool`. Search extracted
bundle strings for server-only variable names and values: Stripe secret/webhook
keys, `DATABASE_URL`, CJ credentials, VAPID private key,
`WEB_PUSH_ENCRYPTION_KEY`, OAuth client secrets and session secrets. A public
VAPID key or public OAuth identifier is not secret. Do not upload if inspection
is not clean.

## Deterministic TWA verification

Install the build produced by the Internal Testing track—not a locally debug-
signed APK—then run:

```text
adb shell pm verify-app-links --re-verify com.todijo.marketplace
adb shell pm get-app-links com.todijo.marketplace
adb logcat -c
adb shell am start -a android.intent.action.VIEW -d https://todijo.com/en/product/TEST
adb logcat -d
```

The domain must be verified and launches must show no URL bar/browser chrome.
An unverified domain, chooser, visible toolbar, `OriginVerifier` failure, or
Custom Tab is a release blocker—not a cosmetic fallback.

Record pass/fail (never infer results) on an API 36 emulator and physical phone,
plus one older supported Android device; normal/narrow phone, English/French,
Arabic RTL, gestures/three-button navigation, cutout, large text, keyboard/IME,
cold deep link, offline state and predictive back. Exercise launch, login/logout,
OAuth return, home/category/search/product/variant/cart, Stripe handoff and
success/cancel return, order/tracking, push permission/delivery/deep link.

## Play policy evidence checklist

Data Safety answers must reflect behavior and owner/provider contracts, not just
the native shell. Repository evidence shows processing of account name/email/
password hash and role; OAuth identifiers; seller/store profile; addresses and
recipient/delivery details; orders, fulfillment and tracking; buyer-seller
messages/reviews; support and refund evidence; security/technical logs; push
subscriptions; cookies and web storage. Stripe handles card entry and seller
services while Todijo retains transaction identifiers/status—not full card data.
Other evidenced processors are Cloudflare Turnstile, Cloudinary, R2-compatible
storage, SMTP, OAuth providers and CJ where supplier fulfillment applies.

Before declarations, the owner must map each Play data type to collected/shared,
purpose, required/optional, ephemeral status, encryption in transit and deletion;
confirm provider contracts, locations/transfers, retention and security review;
and reconcile the final form with the current privacy notice. Do not claim “no
data collected.” Push is contextual, denial is respected, unsubscribe/revocation
exists, lock-screen copy is category-controlled, clicks are path-allowlisted and
payloads contain no server-supplied message body.

Privacy policy: `https://todijo.com/en/info/privacy` (French:
`https://todijo.com/fr/info/privacy`). It is public HTTPS and requires no login.
Deletion request: `https://todijo.com/en/info/data-deletion` (French equivalent
under `/fr`). It is linked in the app/TWA footer, initiates a privacy-category
request, discloses identity verification and legal/transaction retention. There
is no immediate self-service hard-delete button; the owner must disclose this
request workflow accurately in Play and confirm Play accepts it as the in-app
initiation path. Actual destructive deletion remains authenticated/verified and
protected financial/audit records block unsafe hard deletion.

## Store listing copy and assets

Recommended category: Shopping (owner confirms in Console). Contact email,
website and any required phone/address must be real owner-controlled details.

English:

- App name: **Todijo**
- Short description: **Shop marketplace finds and manage orders in one place.**
- Full description: **Discover products from marketplace sellers, compare
  options, save favorites and manage your cart. Sign in to follow orders,
  delivery tracking, messages and notifications. Payments use secure hosted
  Stripe Checkout; product, stock and order status remain connected to Todijo’s
  live web marketplace.**

French:

- Nom: **Todijo**
- Description courte: **Achetez sur la marketplace et suivez vos commandes.**
- Description complète: **Découvrez les produits de vendeurs de la marketplace,
  comparez les options, enregistrez vos favoris et gérez votre panier.
  Connectez-vous pour suivre vos commandes, livraisons, messages et
  notifications. Les paiements passent par la page sécurisée Stripe Checkout ;
  produits, stocks et commandes restent reliés à la marketplace web Todijo.**

Still required: owner-approved 512×512 Play icon (existing adaptive launcher art
must be exported/checked), 1024×500 feature graphic, at least two current phone
screenshots per listing, optional tablet screenshots only if tablet availability
is claimed, verified category/contact details, privacy/deletion URLs, content
rating, ads declaration, target audience, app access reviewer instructions, Data
Safety and account-deletion declarations. Screenshots must come from the final
verified Play build and must not imply untested features.

## Internal Testing sequence

1. Create/select **Todijo** with package `com.todijo.marketplace`; never reuse the
   package for another concept.
2. Enable Play App Signing and create/register the owner-controlled upload key.
3. Copy the **App signing key certificate** SHA-256.
4. Replace only the template placeholder in production `assetlinks.json`, merge,
   redeploy once, and verify the well-known response.
5. Configure private signing values, build `bundleRelease`, inspect and archive
   the signed AAB and checksums securely.
6. Complete required Play app-content declarations with owner/legal review.
7. Upload version code 1 only to Internal Testing, add named tester(s), publish
   the internal release, and install using Play’s opt-in link.
8. Run the TWA/App Links and device matrix above; verify push and Stripe return.
9. Fix blockers with a higher versionCode. Consider Closed/Production only after
   recorded internal evidence and a separate owner release decision.

No Google Play Production submission or public release is authorized by this
runbook.
