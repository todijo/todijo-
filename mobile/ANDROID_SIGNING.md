# Android upload signing

The current Flutter application ID is `com.todijo.app`. The validated WebView
shell and App Links routing are unchanged by signing configuration.

## Local upload identity

Created on 2026-09-30 after checking local project and common signing locations:

- Keystore: `C:\Users\allan\.android\todijo-signing\todijo-upload.jks`
- Alias: `todijo-upload`
- RSA: 3072 bits; certificate signature: SHA256withRSA
- Certificate validity ends 2067-10-25 (15,000 days).
- Certificate SHA-256:
  `EF:18:AA:F7:FD:99:4A:E2:06:25:40:A4:79:E7:79:EC:D0:2A:DE:13:A5:53:BB:93:AD:CA:2E:25:9B:0E:4B:CF`
- Public certificate: `C:\Users\allan\.android\todijo-signing\todijo-upload-certificate.pem`
- Private credential handoff: `C:\Users\allan\.android\todijo-signing\credentials.private.json`

The signing folder is outside Git, with Windows ACL access limited to the
current account and SYSTEM. Passwords were generated independently using a
cryptographic random generator. No password is stored in this document.

## Release environment

Gradle retains its existing fail-closed environment-variable configuration:

- `TODIJO_ANDROID_KEYSTORE_PATH`: absolute keystore path
- `TODIJO_ANDROID_STORE_PASSWORD`: keystore password
- `TODIJO_ANDROID_KEY_ALIAS`: alias above
- `TODIJO_ANDROID_KEY_PASSWORD`: private-key password, distinct from store password

To supply these only to a local PowerShell process without printing them:

```powershell
$signingValues = Get-Content -Raw -LiteralPath 'C:\Users\allan\.android\todijo-signing\credentials.private.json' | ConvertFrom-Json
foreach ($entry in $signingValues.PSObject.Properties) {
    [Environment]::SetEnvironmentVariable($entry.Name, [string]$entry.Value, 'Process')
}
flutter build apk --release --dart-define=TODIJO_FLAVOR=production --dart-define=TODIJO_API_ORIGIN=https://todijo.com
```

Supply the same environment for `flutter build appbundle --release` when an AAB
is needed. Build locally only; upload and publication require separate authorization.
Do not echo variables or commit the credential file, keystore, private-key export,
secret environment files, or generated build artifacts.

## Backup and handoff

Save both passwords, alias and keystore path in a password manager. Keep at least
two encrypted keystore backups in separate owner-controlled locations, with the
passwords stored separately. Verify a restored backup using `keytool -list` and
the certificate fingerprint above. Do not delete the local copy before verified
backups exist. No off-device backup has been created by this task.

The PEM file is a public certificate, not a private key. Share only this public
certificate when enrolling the upload identity; keep the JKS and passwords private.

## Google Play and Digital Asset Links

This is the permanent local **upload key**, not a claim about Google's eventual
**app-signing key**. Google Play App Signing signs distributed APKs using the
app-signing key. A different Play certificate must be obtained from Play Console
after enrollment and used for the production association.

`android/assetlinks.template.json` records only this genuine local upload-key
fingerprint, targeting `com.todijo.app` with
`delegate_permission/common.handle_all_urls`. It can match APKs signed locally
with this key. Its fingerprint array can hold additional legitimate distribution
certificates when needed; do not add debug or placeholder fingerprints.

`public/.well-known/assetlinks.json` remains unchanged as `[]`. Nothing has been
published live. Production verified App Links remain pending the actual Play
app-signing certificate, domain publication and device verification. The obsolete
unpublished TWA package `com.todijo.marketplace` is not an association target.
