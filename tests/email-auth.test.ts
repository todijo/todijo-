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
  const message = todijoEmailTemplate({ preview:"Preview",heading:"Hello <buyer>",greeting:"Hi A&B",body:"Body",ctaLabel:"Continue",ctaUrl:"https://todijo.com/?x=1&y=2",fallbackLabel:"Fallback",securityNote:"Security",supportLabel:"Support",copyright:"Copyright" });
  assert.doesNotMatch(message.html, /<buyer>/);
  assert.match(message.html, /A&amp;B/);
  assert.match(message.text, /https:\/\/todijo\.com/);
  assert.match(message.html, /mailto:support@todijo\.com/);
});

test("all authentication locales have exact translation parity and localized recovery routes", () => {
  const locales = ["ar", "de", "en", "es", "fr", "it", "ku", "nl", "tr"];
  const messages = locales.map((locale) => JSON.parse(readFileSync(`messages/auth/${locale}.json`, "utf8")) as Record<string, string>);
  const keys = Object.keys(messages[2]).sort();
  for (const message of messages) assert.deepEqual(Object.keys(message).sort(), keys);
  assert.match(readFileSync("app/login/page.tsx", "utf8"), /localizedHome\(locale\)\}\/forgot-password/);
  assert.match(readFileSync("app/reset-password/page.tsx", "utf8"), /localizedHome\(locale\)\}\/login\?reset=success/);
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
