# Todijo Android TWA release project

This Stage 1 project is a thin Trusted Web Activity. It contains no marketplace,
pricing, payment, or authentication logic.

Application ID: com.todijo.marketplace
Trusted origin: https://todijo.com
Start URL: https://todijo.com/en?source=twa
Compile/target SDK: Android API 36
Minimum SDK: 23

The verified HTTPS filter intentionally covers all Todijo paths, including
localized home, product, order, tracking, auth-return, and checkout-return
routes. Stripe, OAuth providers, carriers, and other external origins are
deliberately absent and remain in browser UI.

## Digital Asset Links release gate

The deployed public/.well-known/assetlinks.json intentionally contains an empty
array. An unconfigured build therefore falls back visibly to a Custom Tab.

Before an Internal Testing release:

1. Enroll in Play App Signing.
2. Copy the App signing key certificate SHA-256 fingerprint from Play Console.
3. Copy `android/assetlinks.template.json`, replacing the placeholder only with
   that Play App Signing fingerprint (not the upload or debug certificate).
4. Publish the completed JSON at the well-known assetlinks URL. Never commit a
   guessed or temporary fingerprint.
5. Confirm HTTP 200, JSON content type, no redirect, exact package and fingerprint.
6. Install the Play-signed build and run the commands below.

    adb shell pm verify-app-links --re-verify com.todijo.marketplace
    adb shell pm get-app-links com.todijo.marketplace
    adb logcat -c
    adb shell am start -a android.intent.action.VIEW -d https://todijo.com/en/product/TEST
    adb logcat -d

Inspect logs for OriginVerifier, digital_asset_links, and TWAProvider. Any visible
address bar or failed verification blocks release.

## Build prerequisites

Install JDK 17, Android SDK Platform 36, Build Tools 36.0.0, and Gradle 9.1.0.
Provide all four release-only properties through a private Gradle user property
file or environment variables:

- `TODIJO_UPLOAD_STORE_FILE`
- `TODIJO_UPLOAD_STORE_PASSWORD`
- `TODIJO_UPLOAD_KEY_ALIAS`
- `TODIJO_UPLOAD_KEY_PASSWORD`

From `android`, run `gradle :app:bundleRelease`. The task fails closed when any
signing value is absent. The expected bundle is
`android/app/build/outputs/bundle/release/app-release.aab`.

No signing key is included or generated. See
`docs/phase9-stage7-google-play-release.md` for the complete owner runbook.

## Android 16 QA

Use an API 36 emulator and physical device. Validate gesture and three-button
navigation, predictive back, cutouts, large fonts, Arabic RTL, 320px/390px
equivalent widths, keyboard resizing, bottom navigation, and sticky purchase
actions. Critical back flows are category-product, product-cart, Stripe return,
OAuth return, order-external tracking, and a cold product deep link.
