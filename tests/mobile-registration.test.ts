import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { prisma } from "../lib/prisma.js";
import { MOBILE_REGISTRATION_CALLBACK, MOBILE_REGISTRATION_TTL_MS, mobileRegistrationHash, mobileRegistrationSecret } from "../lib/mobile-registration.js";
import { validateRegistrationInput, registrationPersistenceData } from "../lib/auth-registration.js";
import { createBuyerAddress } from "../lib/buyer-addresses.js";
import { createMobileSession } from "../lib/mobile-session.js";

const disposable = process.env.DATABASE_URL?.includes("127.0.0.1:55432/todijo_e2e") === true;

test("mobile registration uses a fixed three-minute attempt and fixed callback", () => {
  assert.equal(MOBILE_REGISTRATION_TTL_MS, 180000);
  assert.equal(MOBILE_REGISTRATION_CALLBACK, "todijo://auth/registration");
  assert.equal(mobileRegistrationHash("x").length, 64);
  assert.notEqual(mobileRegistrationSecret(), mobileRegistrationSecret());
});

test("native registration routes never persist raw Turnstile, exchange, proof or password material", () => {
  const files = ["app/api/mobile/auth/registration-turnstile/route.ts", "app/api/mobile/auth/registration-exchange/route.ts", "app/api/mobile/auth/register/route.ts"].map(path => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(files, /data:\s*\{[^}]*turnstileToken/);
  assert.doesNotMatch(files, /data:\s*\{[^}]*registrationProof\s*:/);
  assert.doesNotMatch(files, /console\.[a-z]+\([^)]*(proof|code|token|password)/i);
  assert.match(files, /MOBILE_REGISTRATION_CALLBACK/);
});

test("web registration retains Turnstile and cookie-session behavior", () => {
  const web = readFileSync("app/api/auth/register/route.ts", "utf8");
  assert.match(web, /verifyTurnstileToken\(input\.turnstileToken\)/);
  assert.match(web, /createSession\(/);
  assert.doesNotMatch(web, /MobileRegistrationAttempt|registrationProof/);
});

test("native registration always creates a buyer while retaining optional legacy address support", () => {
  const route = readFileSync("app/api/mobile/auth/register/route.ts", "utf8");
  const contract = readFileSync("lib/auth-registration.ts", "utf8");
  assert.match(route, /validateRegistrationInput\(\{\.\.\.body,turnstileToken:"mobile-registration-proof"\}\)/);
  assert.match(route, /registrationPersistenceData\(input\)/);
  assert.match(route, /if\(input\.shippingAddress\)await createBuyerAddress/);
  assert.match(contract, /role:\s*"CUSTOMER"/);
});

test("database permits exactly one concurrent exchange and one concurrent registration claim", { skip: !disposable }, async () => {
  const now = new Date(), state = mobileRegistrationSecret(), nonce = mobileRegistrationSecret(), exchange = mobileRegistrationSecret(), proof = mobileRegistrationSecret();
  const row = await prisma.mobileRegistrationAttempt.create({ data: { platform: "android", emailHash: mobileRegistrationHash(`registration-${Date.now()}@example.test`), stateHash: mobileRegistrationHash(state), nonceHash: mobileRegistrationHash(nonce), exchangeCodeHash: mobileRegistrationHash(exchange), turnstileVerifiedAt: now, expiresAt: new Date(now.getTime() + MOBILE_REGISTRATION_TTL_MS) } });
  try {
    const exchangeClaims = await Promise.all([1, 2].map(() => prisma.mobileRegistrationAttempt.updateMany({ where: { id: row.id, exchangeCodeHash: mobileRegistrationHash(exchange), exchangeConsumedAt: null, expiresAt: { gt: now } }, data: { exchangeConsumedAt: now, registrationProofHash: mobileRegistrationHash(proof) } })));
    assert.deepEqual(exchangeClaims.map(x => x.count).sort(), [0, 1]);
    const registrationClaims = await Promise.all([1, 2].map(() => prisma.mobileRegistrationAttempt.updateMany({ where: { id: row.id, registrationProofHash: mobileRegistrationHash(proof), registrationConsumedAt: null, expiresAt: { gt: now } }, data: { registrationConsumedAt: now } })));
    assert.deepEqual(registrationClaims.map(x => x.count).sort(), [0, 1]);
  } finally { await prisma.mobileRegistrationAttempt.delete({ where: { id: row.id } }); }
});

test("real database persists buyer identity with optional address and ignores legacy seller-role input", { skip: !disposable }, async () => {
  process.env.MOBILE_SESSION_SECRET ||= "todijo-disposable-mobile-session-secret-only";
  const marker = `${Date.now()}-${mobileRegistrationSecret().slice(0, 6)}`;
  const base = { firstName: "Native", lastName: "Registration", password: "correct-horse-battery", confirmPassword: "correct-horse-battery", turnstileToken: "verified" };
  const address = { recipientName: "Native Buyer", addressLine1: "1 Test Street", addressLine2: null, postalCode: "75001", city: "Paris", country: "FR", state: null, phone: null };
  const buyer = validateRegistrationInput({ ...base, email: `buyer-${marker}@example.test`, shippingAddress: address });
  const legacySellerChoice = validateRegistrationInput({ ...base, email: `legacy-${marker}@example.test`, role: "seller", storeName: "Native Test Store" });
  assert.equal(buyer.ok, true);
  assert.equal(legacySellerChoice.ok, true);
  if (!buyer.ok || !legacySellerChoice.ok) return;
  const created: string[] = [];
  try {
    const buyerUser = await prisma.user.create({ data: { ...registrationPersistenceData(buyer.value), passwordHash: "test" } });
    created.push(buyerUser.id);
    await createBuyerAddress(prisma, buyerUser.id, buyer.value.shippingAddress!, true);
    const buyerSession = await createMobileSession(buyerUser, { platform: "android" });
    assert.equal(buyerUser.role, "CUSTOMER");
    assert.equal(await prisma.buyerShippingAddress.count({ where: { userId: buyerUser.id } }), 1);
    assert.equal(buyerSession.session.userId, buyerUser.id);

    const legacyUser = await prisma.user.create({ data: { ...registrationPersistenceData(legacySellerChoice.value), passwordHash: "test" } });
    created.push(legacyUser.id);
    const legacySession = await createMobileSession(legacyUser, { platform: "android" });
    assert.equal(legacyUser.role, "CUSTOMER");
    assert.equal(legacyUser.storeName, null);
    assert.equal(await prisma.buyerShippingAddress.count({ where: { userId: legacyUser.id } }), 0);
    assert.equal(legacySession.session.userId, legacyUser.id);
  } finally {
    await prisma.mobileSession.deleteMany({ where: { userId: { in: created } } });
    await prisma.buyerShippingAddress.deleteMany({ where: { userId: { in: created } } });
    await prisma.user.deleteMany({ where: { id: { in: created } } });
  }
});
