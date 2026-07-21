import { Prisma, type PrismaClient } from "@prisma/client";
import { createStripeCheckoutSession, type StripeEvent } from "./stripe";

export class CheckoutError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type CheckoutItem = { productId: string; quantity: number };

export async function createCheckout(
  db: PrismaClient,
  buyerId: string,
  requestId: string,
  requestedItems: CheckoutItem[],
  stripeCreate = createStripeCheckoutSession,
) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new CheckoutError("Invalid checkout request ID.");
  if (!Array.isArray(requestedItems) || requestedItems.length === 0 || requestedItems.length > 100) throw new CheckoutError("Your cart is empty or too large.");
  const quantities = new Map<string, number>();
  for (const item of requestedItems) {
    if (typeof item.productId !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) throw new CheckoutError("Invalid cart item.");
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  const existing = await db.order.findUnique({ where: { buyerId_checkoutRequestId: { buyerId, checkoutRequestId: requestId } }, include: { items: true } });
  if (existing?.stripeCheckoutSessionId && existing.stripeCheckoutUrl) {
    return { orderId: existing.id, sessionId: existing.stripeCheckoutSessionId, url: existing.stripeCheckoutUrl, reused: true };
  }
  if (existing && existing.status !== "PENDING") throw new CheckoutError("This checkout request can no longer be reused.", 409);

  const products = await db.product.findMany({ where: { id: { in: [...quantities.keys()] }, status: "PUBLISHED" }, select: { id: true, name: true, price: true, currency: true, stock: true } });
  if (products.length !== quantities.size) throw new CheckoutError("One or more products are unavailable.", 409);
  const currencies = new Set(products.map((product) => product.currency.toUpperCase()));
  if (currencies.size !== 1) throw new CheckoutError("All products must use the same currency.");
  for (const product of products) if (product.stock < quantities.get(product.id)!) throw new CheckoutError(`Insufficient stock for ${product.name}.`, 409);
  const total = products.reduce((sum, product) => sum.add(product.price.mul(quantities.get(product.id)!)), new Prisma.Decimal(0));
  if (existing) {
    const sameCart = existing.items.length === quantities.size && existing.items.every((item) => quantities.get(item.productId) === item.quantity && item.unitPrice.equals(products.find((product) => product.id === item.productId)?.price ?? -1));
    if (!sameCart || !existing.total.equals(total) || existing.currency !== products[0].currency.toUpperCase()) throw new CheckoutError("This checkout request belongs to a different cart. Start a new checkout.", 409);
  }

  let order = existing;
  if (!order) {
    try {
      order = await db.order.create({ data: { buyerId, checkoutRequestId: requestId, currency: products[0].currency.toUpperCase(), total, items: { create: products.map((product) => ({ productId: product.id, quantity: quantities.get(product.id)!, unitPrice: product.price })) } }, include: { items: true } });
    } catch (error) {
      if (!isPrismaCode(error, "P2002")) throw error;
      order = await db.order.findUniqueOrThrow({ where: { buyerId_checkoutRequestId: { buyerId, checkoutRequestId: requestId } }, include: { items: true } });
      if (order.stripeCheckoutSessionId && order.stripeCheckoutUrl) return { orderId: order.id, sessionId: order.stripeCheckoutSessionId, url: order.stripeCheckoutUrl, reused: true };
    }
  }
  const buyer = await db.user.findUniqueOrThrow({ where: { id: buyerId }, select: { email: true } });
  const session = await stripeCreate({ orderId: order.id, idempotencyKey: `checkout:${buyerId}:${requestId}`, email: buyer.email, items: products.map((product) => ({ name: product.name, unitAmount: Number(product.price.mul(100).toFixed(0)), quantity: quantities.get(product.id)!, currency: product.currency })) });
  await db.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id, stripeCheckoutUrl: session.url } });
  return { orderId: order.id, sessionId: session.id, url: session.url, reused: false };
}

export async function processStripeEvent(db: PrismaClient, event: StripeEvent) {
  try {
    return await db.$transaction(async (tx) => {
      await tx.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
      const session = event.data.object;
      const orderId = session.metadata?.orderId ?? session.client_reference_id;
      if (!orderId) return { ignored: true };
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        if (session.payment_status !== "paid") return { ignored: true };
        const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
        if (!order) return { ignored: true };
        if (order.status === "PAID") return { duplicate: true };
        if (order.status !== "PENDING" || (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id)) throw new Error("Stripe session does not match the pending order.");
        for (const item of order.items) {
          const changed = await tx.product.updateMany({ where: { id: item.productId, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
          if (changed.count !== 1) throw new CheckoutError("Insufficient stock while finalizing payment.", 409);
        }
        await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date(), stripeCheckoutSessionId: session.id, stripePaymentIntentId: session.payment_intent } });
        return { paid: true };
      }
      if (event.type === "checkout.session.expired" || event.type === "payment_intent.payment_failed") {
        await tx.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
        return { cancelled: true };
      }
      return { ignored: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isPrismaCode(error, "P2002")) return { duplicate: true };
    throw error;
  }
}

function isPrismaCode(error: unknown, code: string): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}
