const { randomUUID } = require("node:crypto");
const { hash } = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { issuePlatformLoyaltyCredit, attestPlatformLoyaltyFunding } =
  require("../.test-dist/lib/loyalty-admin-adjustments.js");

async function main() {
  let database;
  try { database = new URL(process.env.DATABASE_URL || ""); } catch { /* fail closed */ }
  if (process.env.NODE_ENV === "production" ||
    database?.protocol !== "postgresql:" || database.hostname !== "127.0.0.1" ||
    database.port !== "55432" || database.pathname !== "/todijo_e2e" ||
    process.env.APP_URL !== "http://127.0.0.1:3001" ||
    !process.env.TODIJO_LOCAL_BUYER_PASSWORD ||
    process.env.TODIJO_LOCAL_BUYER_PASSWORD.length < 12) {
    throw new Error("DISPOSABLE_FLUTTER_CHECKOUT_SEED_GUARD");
  }
  const db = new PrismaClient();
  try {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
    const email = `flutter-checkout-${suffix}@review.local`;
    const buyer = await db.user.create({ data: { firstName: "Local", lastName: "Flutter",
      email, emailVerified: true,
      passwordHash: await hash(process.env.TODIJO_LOCAL_BUYER_PASSWORD, 12),
      shippingAddresses: { create: { recipientName: "Local Flutter",
        addressLine1: "1 Local Test Street", postalCode: "75001", city: "Paris",
        country: "FR", isDefault: true } } } });
    const seller = await db.user.findUniqueOrThrow({ where: { email: "seller@review.local" } });
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@review.local" } });
    const verifier = await db.user.findUniqueOrThrow({ where: { email: "admin-verifier@review.local" } });
    const store = await db.store.findUniqueOrThrow({ where: { ownerId: seller.id } });
    const product = (label, price) => db.product.create({ data: {
      name: `LOCAL REVIEW Flutter ${label} ${suffix}`, slug: `local-flutter-${label}-${suffix}`,
      description: "Disposable Flutter HTTP checkout fixture only.", price,
      category: "women--outerwear--blazers", condition: "NEW", stock: 2,
      images: [], storeId: store.id, status: "PUBLISHED", loyaltyEligible: true,
    } });
    const [cash, zero] = await Promise.all([product("cash", "10.00"), product("zero", "3.40")]);
    const reference = `local_flutter_${suffix}`;
    await issuePlatformLoyaltyCredit(db, admin.id, { buyerId: buyer.id,
      storeId: store.id, amountMinor: 540, reference,
      reason: "Disposable Flutter HTTP checkout funding only", fundingSource: "PLATFORM_ADMIN" });
    await attestPlatformLoyaltyFunding(db, verifier.id, { reference,
      evidenceReference: `local_journal_${suffix}`,
      note: "Disposable Flutter checkout test attestation" });
    process.stdout.write(JSON.stringify({ email, storeId: store.id,
      cashProductId: cash.id, zeroProductId: zero.id }));
  } finally { await db.$disconnect(); }
}

void main().catch(error => { process.stderr.write(error instanceof Error ? error.message : "seed failed");
  process.exitCode = 1; });
