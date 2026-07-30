import { Prisma, type PrismaClient } from "@prisma/client";
import { connectedAccountStatus, createStripeCheckoutSession, platformFeePercent, retrieveStripeCheckoutSession, retrieveStripeSubscription, type StripeCheckoutSession, type StripeConnectedAccount, type StripeEvent, type StripeInvoice, type StripeSubscription } from "./stripe";
import { cartLineKey, normalizeCartOption } from "./cart-line";

export class CheckoutError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type CheckoutItem = { productId: string; quantity: number; selectedColor?: string | null; selectedSize?: string | null };
const paidOrderStatuses = new Set(["PAID", "PROCESSING", "SHIPPED", "DELIVERED"]);

export async function isBuyerCheckoutComplete(db: PrismaClient, buyerId: string, requestId: string) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) return false;
  const order = await db.order.findUnique({ where: { buyerId_checkoutRequestId: { buyerId, checkoutRequestId: requestId } }, select: { status: true } });
  return Boolean(order && paidOrderStatuses.has(order.status));
}

export async function createCheckout(
  db: PrismaClient,
  buyerId: string,
  requestId: string,
  requestedItems: CheckoutItem[],
  stripeCreate = createStripeCheckoutSession,
) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new CheckoutError("Invalid checkout request ID.");
  if (!Array.isArray(requestedItems) || requestedItems.length === 0 || requestedItems.length > 100) throw new CheckoutError("Your cart is empty or too large.");
  const quantities = new Map<string, CheckoutItem & { lineKey: string }>();
  for (const item of requestedItems) {
    if (typeof item.productId !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) throw new CheckoutError("Invalid cart item.");
    const selectedColor = normalizeCartOption(item.selectedColor), selectedSize = normalizeCartOption(item.selectedSize);
    const lineKey = cartLineKey(item.productId, selectedColor, selectedSize);
    const existingLine = quantities.get(lineKey);
    quantities.set(lineKey, { productId: item.productId, selectedColor, selectedSize, lineKey, quantity: (existingLine?.quantity ?? 0) + item.quantity });
  }

  const existing = await db.order.findUnique({ where: { buyerId_checkoutRequestId: { buyerId, checkoutRequestId: requestId } }, include: { items: true } });
  if (existing?.stripeCheckoutSessionId && existing.stripeCheckoutUrl) {
    return { orderId: existing.id, sessionId: existing.stripeCheckoutSessionId, url: existing.stripeCheckoutUrl, reused: true };
  }
  if (existing && existing.status !== "PENDING") throw new CheckoutError("This checkout request can no longer be reused.", 409);

  const lines = [...quantities.values()];
  const products = await db.product.findMany({ where: { id: { in: [...new Set(lines.map((line) => line.productId))] }, status: "PUBLISHED" }, select: { id: true, name: true, description: true, images: true, colors: true, sizes: true, price: true, currency: true, stock: true, storeId: true, store: { select: { id: true, name: true, slug: true, city: true, country: true, contactEmail: true, phone: true, owner: { select: { stripeAccountId: true, stripeOnboardingComplete: true, stripeChargesEnabled: true } } } } } });
  if (products.length !== new Set(lines.map((line) => line.productId)).size) throw new CheckoutError("One or more products are unavailable.", 409);
  const stores = new Set(products.map((product) => product.storeId));
  if (stores.size !== 1) throw new CheckoutError("MULTIPLE_SELLERS", 409);
  const seller = products[0].store.owner;
  if (!seller.stripeAccountId || !seller.stripeOnboardingComplete || !seller.stripeChargesEnabled) throw new CheckoutError("SELLER_STRIPE_NOT_READY", 409);
  const currencies = new Set(products.map((product) => product.currency.toUpperCase()));
  if (currencies.size !== 1) throw new CheckoutError("All products must use the same currency.");
  for (const line of lines) { const product = products.find((candidate) => candidate.id === line.productId)!; if (((product.colors ?? []).length && (!line.selectedColor || !(product.colors ?? []).includes(line.selectedColor))) || ((product.sizes ?? []).length && (!line.selectedSize || !(product.sizes ?? []).includes(line.selectedSize)))) throw new CheckoutError("Selected product options are unavailable.", 409); }
  for (const product of products) { const quantity = lines.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0); if (product.stock < quantity) throw new CheckoutError(`Insufficient stock for ${product.name}.`, 409); }
  const total = lines.reduce((sum, line) => sum.add(products.find((product) => product.id === line.productId)!.price.mul(line.quantity)), new Prisma.Decimal(0));
  const totalAmount = Number(total.mul(100).toFixed(0));
  const platformFeeAmount = Math.round(totalAmount * platformFeePercent() / 100);
  const sellerAmount = totalAmount - platformFeeAmount;
  if (existing) {
    const sameCart = existing.items.length === lines.length && existing.items.every((item) => lines.some((line) => line.productId === item.productId && line.quantity === item.quantity && item.unitPrice.equals(products.find((product) => product.id === item.productId)?.price ?? -1)));
    if (!sameCart || !existing.total.equals(total) || existing.currency !== products[0].currency.toUpperCase() || existing.stripeConnectedAccountId !== seller.stripeAccountId || existing.platformFeeAmount !== platformFeeAmount || existing.sellerAmount !== sellerAmount) throw new CheckoutError("This checkout request belongs to a different cart. Start a new checkout.", 409);
  }

  const buyer = await db.user.findUniqueOrThrow({ where: { id: buyerId }, select: { email: true, firstName: true, lastName: true } });
  let order = existing;
  if (!order) {
    try {
      const store = products[0].store;
      order = await db.order.create({ data: { buyerId, checkoutRequestId: requestId, currency: products[0].currency.toUpperCase(), total, subtotal: total, shippingCost: new Prisma.Decimal(0), taxTotal: new Prisma.Decimal(0), shippingCurrency: products[0].currency.toUpperCase(), snapshotSource: "CHECKOUT_CAPTURED", snapshotCapturedAt: new Date(), fulfillmentStatus: "PENDING", buyerNameSnapshot: [buyer.firstName, buyer.lastName].filter(Boolean).join(" ") || null, buyerEmailSnapshot: buyer.email, storeIdSnapshot: store.id, storeNameSnapshot: store.name, storeSnapshot: { id: store.id, name: store.name, slug: store.slug, city: store.city, country: store.country, contactEmail: store.contactEmail, phone: store.phone }, stripeConnectedAccountId: seller.stripeAccountId, platformFeeAmount, sellerAmount, items: { create: lines.map((line) => { const product = products.find((candidate) => candidate.id === line.productId)!; return { productId: product.id, quantity: line.quantity, unitPrice: product.price, lineKey: line.lineKey, productNameSnapshot: product.name, productDescriptionSnapshot: product.description ?? null, productImageUrlSnapshot: product.images?.[0] ?? null, currency: product.currency.toUpperCase(), lineTotal: product.price.mul(line.quantity), selectedColor: line.selectedColor, selectedSize: line.selectedSize, selectedOptions: { color: line.selectedColor, size: line.selectedSize } }; }) } }, include: { items: true } });
    } catch (error) {
      if (!isPrismaCode(error, "P2002")) throw error;
      order = await db.order.findUniqueOrThrow({ where: { buyerId_checkoutRequestId: { buyerId, checkoutRequestId: requestId } }, include: { items: true } });
      if (order.stripeCheckoutSessionId && order.stripeCheckoutUrl) return { orderId: order.id, sessionId: order.stripeCheckoutSessionId, url: order.stripeCheckoutUrl, reused: true };
    }
  }
  const session = await stripeCreate({ orderId: order.id, idempotencyKey: `checkout:${buyerId}:${requestId}`, email: buyer.email, connectedAccountId: seller.stripeAccountId, platformFeeAmount, items: lines.map((line) => { const product = products.find((candidate) => candidate.id === line.productId)!; return { name: [product.name, line.selectedColor, line.selectedSize].filter(Boolean).join(" · "), unitAmount: Number(product.price.mul(100).toFixed(0)), quantity: line.quantity, currency: product.currency }; }) });
  await db.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id, stripeCheckoutUrl: session.url } });
  return { orderId: order.id, sessionId: session.id, url: session.url, reused: false };
}

export async function processStripeEvent(
  db: PrismaClient,
  event: StripeEvent,
  retrieveSubscription = retrieveStripeSubscription,
  retrieveCheckoutSession = retrieveStripeCheckoutSession,
) {
  let checkoutSession = event.data.object as StripeCheckoutSession;
  const sellerCheckout = event.type === "checkout.session.completed"
    && (checkoutSession.mode === "subscription" || checkoutSession.metadata?.kind === "seller_subscription");
  let checkoutSubscription: StripeSubscription | null = null;
  if (sellerCheckout) {
    const subscriptionId = stripeObjectId(checkoutSession.subscription);
    if (!subscriptionId) throw new Error(`[Stripe webhook ${event.id}] Subscription Checkout session ${checkoutSession.id} has no subscription ID.`);
    console.info(`[Stripe webhook ${event.id}] Retrieving subscription ${subscriptionId} for Checkout session ${checkoutSession.id}.`);
    checkoutSubscription = await retrieveSubscription(subscriptionId);
    if (!checkoutSubscription?.id) throw new Error(`[Stripe webhook ${event.id}] Stripe returned no subscription for ${subscriptionId}.`);
  }
  if (process.env.STRIPE_SECRET_KEY && !sellerCheckout && (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded")) {
    checkoutSession = await retrieveCheckoutSession(checkoutSession.id);
  }
  const webhookDelegate = (db as PrismaClient & { stripeWebhookEvent?: typeof db.stripeWebhookEvent }).stripeWebhookEvent as (typeof db.stripeWebhookEvent & {
    findUnique?: (args: { where: { id: string }; select: { id: true } }) => Promise<{ id: string } | null>;
  }) | undefined;
  const previouslyProcessed = webhookDelegate?.findUnique
    ? await webhookDelegate.findUnique({ where: { id: event.id }, select: { id: true } })
    : null;
  if (previouslyProcessed && !sellerCheckout) {
    console.info(`[Stripe webhook ${event.id}] Event was already processed; no repair is required.`);
    return { duplicate: true };
  }
  if (previouslyProcessed && sellerCheckout) {
    console.warn(`[Stripe webhook ${event.id}] Replaying an existing subscription Checkout event to repair local subscription state.`);
  }

  try {
    return await db.$transaction(async (tx) => {
      if (!previouslyProcessed) await tx.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
      console.info(`[Stripe webhook ${event.id}] Processing ${event.type}.`);
      if (event.type === "account.updated") {
        const account = event.data.object as StripeConnectedAccount;
        if (account.object !== "account" || !account.id) return { ignored: true };
        const changed = await tx.user.updateMany({ where: { stripeAccountId: account.id }, data: connectedAccountStatus(account) });
        return changed.count ? { accountUpdated: true } : { ignored: true };
      }
      if (event.type.startsWith("customer.subscription.")) {
        const subscription = event.data.object as StripeSubscription;
        if (subscription.object !== "subscription") throw new Error(`[Stripe webhook ${event.id}] Expected a subscription object.`);
        const synced = await syncSellerSubscription(tx, subscription, event.type, event.id);
        return { subscriptionUpdated: true, storeId: synced.storeId, status: synced.status };
      }
      if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
        const invoice = event.data.object as StripeInvoice;
        const invoiceSubscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
        if (invoice.object !== "invoice" || !invoiceSubscriptionId) throw new Error(`[Stripe webhook ${event.id}] Invoice event has no subscription ID.`);
        const status = event.type === "invoice.paid" ? "ACTIVE" : "PAST_DUE";
        const existing = await tx.sellerSubscription.findUnique({ where: { stripeSubscriptionId: invoiceSubscriptionId }, select: { storeId: true } });
        if (!existing) throw new Error(`[Stripe webhook ${event.id}] No local seller subscription matches invoice subscription ${invoiceSubscriptionId}.`);
        await tx.sellerSubscription.update({ where: { stripeSubscriptionId: invoiceSubscriptionId }, data: { status } });
        if (status === "ACTIVE") {
          await tx.store.update({ where: { id: existing.storeId }, data: { status: "ACTIVE" } });
          await tx.product.updateMany({ where: { storeId: existing.storeId, deactivationReason: "SUBSCRIPTION_INACTIVE" }, data: { status: "PUBLISHED", deactivationReason: "NONE" } });
        } else {
          await tx.product.updateMany({ where: { storeId: existing.storeId, status: "PUBLISHED", deactivationReason: "NONE" }, data: { status: "DRAFT", deactivationReason: "SUBSCRIPTION_INACTIVE" } });
        }
        console.info(`[Stripe webhook ${event.id}] Invoice updated store ${existing.storeId} subscription to ${status}.`);
        return { subscriptionUpdated: true, storeId: existing.storeId, status };
      }
      const session = checkoutSession;
      if (sellerCheckout) {
        if (!checkoutSubscription) throw new Error(`[Stripe webhook ${event.id}] Retrieved subscription is unavailable.`);
        const synced = await syncSellerSubscription(tx, checkoutSubscription, event.type, event.id, {
          storeId: session.metadata?.storeId ?? session.client_reference_id ?? undefined,
          userId: session.metadata?.userId,
          customerId: stripeObjectId(session.customer),
          plan: session.metadata?.plan,
        });
        return { subscriptionCheckoutCompleted: true, storeId: synced.storeId, status: synced.status };
      }
      const orderId = session.metadata?.orderId ?? session.client_reference_id;
      if (!orderId) return { ignored: true };
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        if (session.payment_status !== "paid") return { ignored: true };
        const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
        if (!order) return { ignored: true };
        if (order.status === "PAID") return { duplicate: true };
        if (order.status !== "PENDING" || (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id)) throw new Error("Stripe session does not match the pending order.");
        if (order.stripeConnectedAccountId && session.metadata?.connectedAccountId !== order.stripeConnectedAccountId) throw new Error("Stripe destination account does not match the order.");
        const expectedAmount = Number(order.total.mul(100).toFixed(0));
        if (session.amount_total != null && session.amount_total !== expectedAmount) throw new Error("Stripe total does not match the order.");
        if (session.currency && session.currency.toUpperCase() !== order.currency) throw new Error("Stripe currency does not match the order.");
        for (const item of order.items) {
          const changed = await tx.product.updateMany({ where: { id: item.productId, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
          if (changed.count !== 1) throw new CheckoutError("Insufficient stock while finalizing payment.", 409);
        }
        const shipping = session.collected_information?.shipping_details ?? session.shipping_details;
        const address = shipping?.address;
        await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date(), stripeCheckoutSessionId: session.id, stripePaymentIntentId: session.payment_intent, recipientName: shipping?.name ?? session.customer_details?.name ?? null, recipientEmail: session.customer_details?.email ?? null, recipientPhone: shipping?.phone ?? session.customer_details?.phone ?? null, shippingAddressLine1: address?.line1 ?? null, shippingAddressLine2: address?.line2 ?? null, shippingCity: address?.city ?? null, shippingPostalCode: address?.postal_code ?? null, shippingState: address?.state ?? null, shippingCountry: address?.country ?? null, shippingCapturedAt: new Date(), subtotal: session.amount_subtotal != null ? new Prisma.Decimal(session.amount_subtotal).div(100) : order.subtotal, shippingCost: new Prisma.Decimal(session.total_details?.amount_shipping ?? 0).div(100), taxTotal: new Prisma.Decimal(session.total_details?.amount_tax ?? 0).div(100) } });
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

async function syncSellerSubscription(
  tx: Prisma.TransactionClient,
  subscription: StripeSubscription,
  eventType: string,
  eventId: string,
  hint: { storeId?: string; userId?: string; customerId?: string; plan?: string } = {},
) {
  const customerId = stripeObjectId(subscription.customer) ?? hint.customerId;
  if (!customerId) throw new Error(`[Stripe webhook ${eventId}] Subscription ${subscription.id} has no customer ID.`);
  const existing = await tx.sellerSubscription.findFirst({
    where: { OR: [{ stripeSubscriptionId: subscription.id }, { store: { stripeCustomerId: customerId } }, ...(hint.storeId ? [{ storeId: hint.storeId }] : [])] },
    select: { storeId: true, plan: true, stripePriceId: true },
  });
  console.info(`[Stripe webhook ${eventId}] Local subscription lookup result.`, existing
    ? { found: true, storeId: existing.storeId, plan: existing.plan, stripePriceId: existing.stripePriceId }
    : { found: false, subscriptionId: subscription.id, customerId, hintedStoreId: hint.storeId ?? null });
  const storeId = subscription.metadata?.storeId ?? hint.storeId ?? existing?.storeId;
  if (!storeId) throw new Error(`[Stripe webhook ${eventId}] Cannot resolve a store for subscription ${subscription.id}.`);
  const store = await tx.store.findUnique({ where: { id: storeId }, select: { id: true, ownerId: true, stripeCustomerId: true } });
  if (!store) throw new Error(`[Stripe webhook ${eventId}] Store ${storeId} does not exist.`);
  if (hint.userId && store.ownerId !== hint.userId) throw new Error(`[Stripe webhook ${eventId}] Checkout user does not own store ${storeId}.`);
  if (store.stripeCustomerId && store.stripeCustomerId !== customerId) throw new Error(`[Stripe webhook ${eventId}] Stripe customer does not match store ${storeId}.`);
  const priceId = subscription.items?.data?.[0]?.price?.id ?? existing?.stripePriceId;
  if (!priceId) throw new Error(`[Stripe webhook ${eventId}] Subscription ${subscription.id} has no Stripe Price ID.`);
  const status = localSubscriptionStatus(subscription.status, eventType);
  const active = status === "ACTIVE" || status === "TRIALING";
  const item = subscription.items?.data?.[0];
  const currentPeriodStart = stripeDate(subscription.current_period_start ?? item?.current_period_start);
  const currentPeriodEnd = stripeDate(subscription.current_period_end ?? item?.current_period_end);
  if (active && !currentPeriodEnd) throw new Error(`[Stripe webhook ${eventId}] Active subscription ${subscription.id} has no current period end.`);

  console.info(`[Stripe webhook ${eventId}] Updating store ${storeId}: customer=${customerId}, subscription=${subscription.id}, price=${priceId}, status=${status}.`);
  const storeUpdate = await tx.store.update({ where: { id: storeId }, data: { stripeCustomerId: customerId, ...(active ? { status: "ACTIVE" } : {}) }, select: { id: true, status: true, stripeCustomerId: true } });
  console.info(`[Stripe webhook ${eventId}] Store database update result.`, storeUpdate);
  const subscriptionUpdate = await tx.sellerSubscription.upsert({
    where: { storeId },
    create: { storeId, stripeSubscriptionId: subscription.id, stripePriceId: priceId, plan: subscription.metadata?.plan ?? hint.plan ?? existing?.plan ?? "seller", status, cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end), currentPeriodStart, currentPeriodEnd },
    update: { stripeSubscriptionId: subscription.id, stripePriceId: priceId, plan: subscription.metadata?.plan ?? hint.plan ?? existing?.plan, status, cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end), currentPeriodStart, currentPeriodEnd },
  });
  console.info(`[Stripe webhook ${eventId}] SellerSubscription database update result.`, {
    id: subscriptionUpdate.id,
    storeId: subscriptionUpdate.storeId,
    status: subscriptionUpdate.status,
    stripeSubscriptionId: subscriptionUpdate.stripeSubscriptionId,
    stripePriceId: subscriptionUpdate.stripePriceId,
    currentPeriodEnd: subscriptionUpdate.currentPeriodEnd,
  });
  const products = active
    ? await tx.product.updateMany({ where: { storeId, deactivationReason: "SUBSCRIPTION_INACTIVE" }, data: { status: "PUBLISHED", deactivationReason: "NONE" } })
    : await tx.product.updateMany({ where: { storeId, status: "PUBLISHED", deactivationReason: "NONE" }, data: { status: "DRAFT", deactivationReason: "SUBSCRIPTION_INACTIVE" } });
  console.info(`[Stripe webhook ${eventId}] Saved ${status} subscription for store ${storeId}; updated ${products.count} product(s).`);
  return { storeId, status };
}

function stripeDate(value?: number) {
  return value ? new Date(value * 1000) : null;
}

function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

function localSubscriptionStatus(status: string, eventType: string) {
  if (eventType === "customer.subscription.deleted") return "CANCELED" as const;
  const statuses = { active: "ACTIVE", trialing: "TRIALING", past_due: "PAST_DUE", unpaid: "UNPAID", canceled: "CANCELED", incomplete_expired: "EXPIRED", incomplete: "INCOMPLETE" } as const;
  return statuses[status as keyof typeof statuses] ?? "INCOMPLETE";
}

function isPrismaCode(error: unknown, code: string): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}
