import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { createStripeCheckoutSession } from "./stripe";
import { releaseLoyaltyReservations } from "./loyalty-reservations";

/** A deliberately narrow, server-only provider seam for the disposable RC DB.
 * It never marks an order paid and cannot be enabled in a production build. */
type LocalCheckoutEnvironment = { NODE_ENV?: string; TODIJO_LOCAL_CHECKOUT_PROVIDER?: string;
  TODIJO_LOCAL_CHECKOUT_PROVIDER_OUTCOME?: string; STRIPE_MODE?: string;
  STRIPE_SECRET_KEY?: string; DATABASE_URL?: string; APP_URL?: string };
export function localCheckoutProviderEnabled(env: LocalCheckoutEnvironment = process.env as LocalCheckoutEnvironment) {
  if ((env.NODE_ENV !== "development" && env.NODE_ENV !== "test") ||
    env.TODIJO_LOCAL_CHECKOUT_PROVIDER !== "enabled" ||
    env.STRIPE_MODE !== "test" || env.STRIPE_SECRET_KEY ||
    env.APP_URL !== "http://127.0.0.1:3001") return false;
  try {
    const database = new URL(env.DATABASE_URL ?? "");
    return database.protocol === "postgresql:" && database.hostname === "127.0.0.1" &&
      database.port === "55432" && database.pathname === "/todijo_e2e";
  } catch { return false; }
}

export class LocalCheckoutProviderFailure extends Error {
  constructor() { super("LOCAL_CHECKOUT_PROVIDER_REJECTED"); }
}

export function localCheckoutProvider(env: LocalCheckoutEnvironment = process.env as LocalCheckoutEnvironment) {
  if (!localCheckoutProviderEnabled(env)) return null;
  const retrieveConnectedAccount: typeof import("./stripe").retrieveConnectedAccount = async id => {
    if (!/^acct_test_local_[A-Za-z0-9_-]+$/.test(id)) throw new LocalCheckoutProviderFailure();
    return { id, object: "account", details_submitted: true, charges_enabled: true,
      payouts_enabled: true } as Awaited<ReturnType<typeof import("./stripe").retrieveConnectedAccount>>;
  };
  const stripeCreate: typeof createStripeCheckoutSession = async input => {
    if (env.TODIJO_LOCAL_CHECKOUT_PROVIDER_OUTCOME === "reject") throw new LocalCheckoutProviderFailure();
    if (env.TODIJO_LOCAL_CHECKOUT_PROVIDER_OUTCOME &&
      env.TODIJO_LOCAL_CHECKOUT_PROVIDER_OUTCOME !== "accept") throw new LocalCheckoutProviderFailure();
    const digest = createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 32);
    return { id: `cs_test_local_${digest}`,
      url: `https://checkout.stripe.test/local-review/${digest}`,
      expiresAt: new Date(Date.now() + 30 * 60_000) };
  };
  return { retrieveConnectedAccount, stripeCreate };
}

/** A local adapter rejection is definitive: no external session was created.
 * Keep the order audit trail, but release its hold and make the key stale. */
export async function cancelRejectedLocalCheckout(db: PrismaClient, buyerId: string,
  requestId: string, env: LocalCheckoutEnvironment = process.env as LocalCheckoutEnvironment) {
  if (!localCheckoutProviderEnabled(env)) throw new Error("LOCAL_CHECKOUT_PROVIDER_DISABLED");
  return db.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { buyerId_checkoutRequestId: {
      buyerId, checkoutRequestId: requestId } }, select: { id: true } });
    if (!order) return false;
    const changed = await tx.order.updateMany({ where: { id: order.id, buyerId,
      status: "PENDING", stripeCheckoutSessionId: null, stripePaymentIntentId: null,
      paidAt: null }, data: { status: "CANCELLED" } });
    if (changed.count !== 1) return false;
    await releaseLoyaltyReservations(tx, buyerId, requestId);
    await tx.orderLifecycleEvent.create({ data: { orderId: order.id,
      type: "LOCAL_PROVIDER_REJECTED", metadata: { localOnly: true } } });
    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
