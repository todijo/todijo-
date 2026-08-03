import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compare, hash } from "bcryptjs";
import { allowAuthRequest } from "../lib/auth-rate-limit";
import { authTokenState, generateRawAuthToken, hashAuthToken, validRawAuthToken } from "../lib/auth-token-crypto";
import { escapeEmailHtml, todijoEmailTemplate } from "../lib/email/template";

test("authentication tokens are cryptographically random and only their SHA-256 hashes are storage-safe", () => {
  const first = generateRawAuthToken();
  const second = generateRawAuthToken();
  assert.equal(validRawAuthToken(first), true);
  assert.notEqual(first, second);
  assert.match(hashAuthToken(first), /^[a-f0-9]{64}$/);
  assert.equal(hashAuthToken(first).includes(first), false);
});

test("expired and already-used authentication tokens are rejected", () => {
  const now = new Date("2026-08-03T12:00:00.000Z");
  assert.equal(authTokenState(null, now), "invalid");
  assert.equal(authTokenState({ usedAt: new Date(now.getTime() - 1), expiresAt: new Date(now.getTime() + 1000) }, now), "already-used");
  assert.equal(authTokenState({ usedAt: null, expiresAt: new Date(now.getTime() - 1) }, now), "expired");
  assert.equal(authTokenState({ usedAt: null, expiresAt: new Date(now.getTime() + 1) }, now), "success");
});

test("forgot-password and resend rate limits reject bursts without exposing account state", () => {
  const key = `email-auth-test-${Date.now()}`;
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal(allowAuthRequest(key, 1_000 + attempt), true);
  assert.equal(allowAuthRequest(key, 1_010), false);
  for (const route of ["forgot-password", "resend-verification"]) {
    const source = readFileSync(`app/api/auth/${route}/route.ts`, "utf8");
    assert.match(source, /const neutral = \{ ok: true, code:/);
    assert.match(source, /if \(!user/);
    assert.doesNotMatch(source, /USER_NOT_FOUND|EMAIL_NOT_FOUND/);
  }
});

test("verification and reset consumption are atomic, expiring, one-time operations", () => {
  const source = readFileSync("lib/auth-tokens.ts", "utf8");
  assert.match(source, /minimumIntervalMs/);
  assert.match(source, /isolationLevel: "Serializable"/);
  assert.match(source, /usedAt: null, expiresAt: \{ gt: now \}/);
  assert.match(source, /emailVerified: true, emailVerifiedAt: now/);
  assert.match(source, /passwordHash/);
  assert.match(source, /updateMany\(\{ where: \{ userId: token\.userId, id: \{ not: token\.id \}, usedAt: null \}/);
});

test("password reset requires confirmation and stores a bcrypt cost-12 hash", async () => {
  const source = readFileSync("app/api/auth/reset-password/route.ts", "utf8");
  assert.match(source, /password !== confirmPassword/);
  assert.match(source, /hash\(password, 12\)/);
  const passwordHash = await hash("new-password-123", 12);
  assert.equal(await compare("new-password-123", passwordHash), true);
  assert.equal(await compare("wrong-password", passwordHash), false);
});

test("registration remains successful when email preparation or SMTP delivery fails", () => {
  const source = readFileSync("app/api/auth/register/route.ts", "utf8");
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /Registration email delivery failed/);
  assert.match(source, /Registration email preparation failed/);
  assert.ok(source.indexOf("await createSession") > source.indexOf("Registration email preparation failed"));
  assert.match(source, /return NextResponse\.json\(\{ ok: true, role: user\.role \}\)/);
});

test("shared Todijo email template escapes names and URLs and includes text fallback", () => {
  assert.equal(escapeEmailHtml('<script>"x"</script>'), "&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
  const message = todijoEmailTemplate({ direction:"ltr",preview:"Preview",heading:"Hello <buyer>",greeting:"Hi A&B",body:"Body",ctaLabel:"Continue",ctaUrl:"https://todijo.com/?x=1&y=2",fallbackLabel:"Fallback",securityNote:"Security",supportLabel:"Need help? Contact",transactional:"This transactional message was sent by Todijo.",copyright:"© 2026 Todijo" });
  assert.doesNotMatch(message.html, /<buyer>/);
  assert.match(message.html, /A&amp;B/);
  assert.match(message.text, /https:\/\/todijo\.com/);
  assert.match(message.html, /mailto:support@todijo\.com/);
  assert.match(message.text, /support@todijo\.com/);
  assert.match(message.html, /<meta charset="utf-8">/);
  assert.match(message.html, /prefers-color-scheme:dark/);
  assert.match(message.html, /role="presentation"/);
  assert.match(message.html, /\[if mso\]/);
  assert.match(message.html, /overflow-wrap:anywhere/);
  assert.match(message.html, /@media only screen and \(max-width:480px\)/);
});

test("all authentication locales have exact translation parity and localized recovery routes", () => {
  const locales = ["ar", "de", "en", "es", "fr", "it", "ku", "nl", "tr"];
  const messages = locales.map((locale) => JSON.parse(readFileSync(`messages/auth/${locale}.json`, "utf8")) as Record<string, string>);
  const keys = Object.keys(messages[2]).sort();
  for (const message of messages) assert.deepEqual(Object.keys(message).sort(), keys);
  assert.equal(messages[4].verificationTitle, "Vérification de l’e-mail");
  assert.equal(messages[4].verificationSuccessResult, "Votre e-mail a été vérifié avec succès.");
  const corruption = /ï¿½|Ãƒ|Ã¢|â€™|�|\?{2,}|[A-Za-zÀ-ÿ]\?[A-Za-zÀ-ÿ]/;
  for (const message of messages) {
    for (const value of Object.values(message)) assert.doesNotMatch(value, corruption);
  }
  assert.match(readFileSync("app/login/page.tsx", "utf8"), /localizedHome\(locale\)\}\/forgot-password/);
  assert.match(readFileSync("app/reset-password/page.tsx", "utf8"), /localizedHome\(locale\)\}\/login\?reset=success/);
});

test("localized email copy provides polished subjects, footer copy, current year, and RTL output", () => {
  const source = readFileSync("lib/email/messages.ts", "utf8");
  for (const key of ["welcomeSubject", "verifySubject", "resetSubject"]) {
    assert.equal((source.match(new RegExp(`${key}:`, "g")) ?? []).length, 10);
  }
  assert.equal((source.match(/transactional:/g) ?? []).length, 10);
  assert.match(source, /Bienvenue sur Todijo — votre compte est prêt/);
  assert.match(source, /Vérifiez votre e-mail Todijo/);
  assert.match(source, /Réinitialisez votre mot de passe Todijo/);
  assert.match(source, /getUTCFullYear\(\)/);
  const rtl = todijoEmailTemplate({ direction:"rtl",preview:"معاينة",heading:"العنوان",greeting:"مرحبًا",body:"المحتوى",ctaLabel:"متابعة",ctaUrl:"https://todijo.com/ar",fallbackLabel:"الرابط",securityNote:"تنبيه",supportLabel:"للمساعدة",transactional:"رسالة من Todijo",copyright:"© 2026 Todijo" });
  assert.match(rtl.html, /<html dir="rtl">/);
  assert.match(rtl.html, /class="email-content" dir="rtl"/);
});

test("schema and migration are additive and keep verification non-blocking", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync("prisma/migrations/20260803150000_add_email_auth_tokens/migration.sql", "utf8");
  const login = readFileSync("app/api/auth/login/route.ts", "utf8");
  assert.match(schema, /emailVerified\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /emailVerifiedAt\s+DateTime\?/);
  assert.match(schema, /model EmailVerificationToken/);
  assert.match(schema, /model PasswordResetToken/);
  assert.doesNotMatch(schema, /sessionVersion/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);
  assert.doesNotMatch(login, /emailVerified/);
});
