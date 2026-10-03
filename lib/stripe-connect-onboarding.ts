import type { StripeConnectedAccount } from "./stripe";

type Seller = { id: string; email: string; stripeAccountId: string | null };

type StripeConnectPersistence = {
  user: {
    updateMany(input: { where: { id: string; stripeAccountId: null }; data: { stripeAccountId: string } }): Promise<{ count: number }>;
    findUnique(input: { where: { id: string }; select: { stripeAccountId: true } }): Promise<{ stripeAccountId: string | null } | null>;
  };
};

type StripeConnectDependencies = {
  createAccount(input: { userId: string; email: string }): Promise<StripeConnectedAccount>;
  createAccountLink(accountId: string): Promise<string>;
};

export async function startStripeConnectOnboarding(
  db: StripeConnectPersistence,
  seller: Seller,
  dependencies: StripeConnectDependencies,
) {
  let accountId = seller.stripeAccountId;
  if (!accountId) {
    const account = await dependencies.createAccount({ userId: seller.id, email: seller.email });
    const persisted = await db.user.updateMany({
      where: { id: seller.id, stripeAccountId: null },
      data: { stripeAccountId: account.id },
    });
    if (persisted.count === 1) {
      accountId = account.id;
    } else {
      const current = await db.user.findUnique({ where: { id: seller.id }, select: { stripeAccountId: true } });
      accountId = current?.stripeAccountId ?? null;
    }
    if (!accountId) throw new Error("STRIPE_CONNECT_ACCOUNT_NOT_PERSISTED");
  }
  return dependencies.createAccountLink(accountId);
}
