const { hash } = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (process.env.NODE_ENV === 'production' ||
      url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' ||
      url.port !== '55432' || url.pathname !== '/todijo_e2e' ||
      process.env.APP_URL !== 'http://127.0.0.1:3001' ||
      !process.env.TODIJO_LOCAL_REVIEW_PASSWORD ||
      process.env.TODIJO_LOCAL_REVIEW_PASSWORD.length < 20) {
    throw new Error('DISPOSABLE_WEBVIEW_REVIEW_SEED_GUARD');
  }
  const db = new PrismaClient();
  try {
    const passwordHash = await hash(process.env.TODIJO_LOCAL_REVIEW_PASSWORD, 12);
    for (const [kind, role] of [
      ['buyer', 'CUSTOMER'], ['seller', 'SELLER'], ['admin', 'ADMIN'],
    ]) {
      const email = `${kind}@webview-review.local`;
      await db.user.upsert({
        where: { email },
        create: { email, firstName: 'Local', lastName: `WebView ${kind}`,
          role, passwordHash, emailVerified: true, emailVerifiedAt: new Date() },
        update: { passwordHash, emailVerified: true, emailVerifiedAt: new Date(),
          blockedAt: null, deactivatedAt: null },
      });
    }
    const seller = await db.user.findUniqueOrThrow({ where: { email: 'seller@webview-review.local' } });
    await db.store.upsert({
      where: { ownerId: seller.id },
      create: { ownerId: seller.id, name: 'LOCAL WEBVIEW REVIEW STORE',
        slug: 'local-webview-review-store', description: 'Disposable local review data.',
        country: 'FR', city: 'Paris', contactEmail: seller.email,
        status: 'ACTIVE', marketplaceActivatedAt: new Date() },
      update: {},
    });
    console.log('Disposable Buyer, Seller, and Admin review accounts exist; credentials not printed.');
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
