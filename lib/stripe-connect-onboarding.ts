import { StripeApiError, type StripeConnectedAccount } from "./stripe";

type Seller = { id: string; email: string; stripeAccountId: string | null };

type StripeConnectPersistence = {
  user: {
    updateMany(input: {
      where: { id: string; stripeAccountId: null; stripeConnectAccountAttemptGeneration: number };
      data: { stripeAccountId?: string; stripeConnectAccountAttemptGeneration?: { increment: number } };
    }): Promise<{ count: number }>;
    findUnique(input: {
      where: { id: string };
      select: { id?: true; email?: true; stripeAccountId: true; stripeConnectAccountAttemptGeneration?: true };
    }): Promise<{ id?: string; email?: string; stripeAccountId: string | null; stripeConnectAccountAttemptGeneration?: number } | null>;
  };
};

type StripeConnectDependencies = {
  createAccount(input: { userId: string; email: string; idempotencyKey: string }): Promise<StripeConnectedAccount>;
  createAccountLink(accountId: string): Promise<string>;
};

export function connectedAccountIdempotencyKey(userId: string, generation: number) {
  return generation === 0
    ? `connect-account-v2:${userId}`
    : `connect-account-v2:${userId}:attempt:${generation}`;
}

function isDefiniteAccountCreationFailure(error: unknown) {
  if (!(error instanceof StripeApiError)) return false;
  if (error.statusCode == null) return true;
  return error.statusCode >= 400 && error.statusCode < 500 && ![408, 409, 429].includes(error.statusCode);
}

export async function startStripeConnectOnboarding(
  db: StripeConnectPersistence,
  seller: Seller,
  dependencies: StripeConnectDependencies,
) {
  const current = await db.user.findUnique({
    where: { id: seller.id },
    select: { id: true, email: true, stripeAccountId: true, stripeConnectAccountAttemptGeneration: true },
  });
  if (!current) throw new Error("STRIPE_CONNECT_SELLER_NOT_FOUND");
  let accountId = current.stripeAccountId;
  if (!accountId) {
    const generation = current.stripeConnectAccountAttemptGeneration ?? 0;
    let account: StripeConnectedAccount;
    try {
      account = await dependencies.createAccount({
        userId: current.id ?? seller.id,
        email: current.email ?? seller.email,
        idempotencyKey: connectedAccountIdempotencyKey(current.id ?? seller.id, generation),
      });
    } catch (error) {
      if (isDefiniteAccountCreationFailure(error)) {
        await db.user.updateMany({
          where: { id: seller.id, stripeAccountId: null, stripeConnectAccountAttemptGeneration: generation },
          data: { stripeConnectAccountAttemptGeneration: { increment: 1 } },
        });
      }
      throw error;
    }
    const persisted = await db.user.updateMany({
      where: { id: seller.id, stripeAccountId: null, stripeConnectAccountAttemptGeneration: generation },
      data: { stripeAccountId: account.id },
    });
    if (persisted.count === 1) {
      accountId = account.id;
    } else {
      const authoritative = await db.user.findUnique({ where: { id: seller.id }, select: { stripeAccountId: true } });
      accountId = authoritative?.stripeAccountId ?? null;
    }
    if (!accountId) throw new Error("STRIPE_CONNECT_ACCOUNT_NOT_PERSISTED");
  }
  return dependencies.createAccountLink(accountId);
}
