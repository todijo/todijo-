import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processStripeEvent } from "@/lib/payments";
import { assertStripeWebhookMode, verifyStripeWebhook, type StripeCheckoutSession } from "@/lib/stripe";
import { automaticCjFulfillmentEnabled, processOrderSupplierFulfillments } from "@/lib/suppliers/supplier-fulfillment";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let event;
  try {
    event = verifyStripeWebhook(rawBody, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ?? "");
    assertStripeWebhookMode(event);
  } catch (error) {
    console.error("Stripe webhook signature rejected", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  try {
    console.info(`[Stripe webhook ${event.id}] Received ${event.type}.`);
    const session = event.data.object as StripeCheckoutSession;
    const sellerCheckout = event.type === "checkout.session.completed"
      && (session.mode === "subscription" || session.metadata?.kind === "seller_subscription");
    let initialRecord: {
      id: string;
      storeId: string;
      status: string;
      stripeSubscriptionId: string | null;
      stripePriceId: string;
      store: { id: string; ownerId: string; stripeCustomerId: string | null };
    } | null = null;
    if (sellerCheckout) {
      const customerId = stripeId(session.customer);
      const subscriptionId = stripeId(session.subscription);
      const storeId = session.metadata?.storeId ?? session.client_reference_id;
      const userId = session.metadata?.userId;
      console.info(`[Stripe webhook ${event.id}] Subscription Checkout payload.`, {
        checkoutSessionId: session.id,
        customerId,
        subscriptionId,
        metadata: session.metadata ?? {},
        storeId,
        userId,
      });
      const lookup = [
        ...(storeId ? [{ storeId }] : []),
        ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
        ...(customerId ? [{ store: { stripeCustomerId: customerId } }] : []),
      ];
      if (!lookup.length) throw new Error(`Subscription Checkout session ${session.id} contains no usable store, customer, or subscription identifier.`);
      initialRecord = await prisma.sellerSubscription.findFirst({
        where: { OR: lookup },
        select: { id: true, storeId: true, status: true, stripeSubscriptionId: true, stripePriceId: true, store: { select: { id: true, ownerId: true, stripeCustomerId: true } } },
      });
      console.info(`[Stripe webhook ${event.id}] Pre-processing database lookup.`, initialRecord
        ? { found: true, record: initialRecord }
        : { found: false, lookup: { storeId, customerId, subscriptionId, userId } });
    }
    const result = await processStripeEvent(prisma, event);
    const paidOrderId = !sellerCheckout && "paid" in result && result.paid === true
      ? session.metadata?.orderId ?? session.client_reference_id
      : null;
    if (paidOrderId && automaticCjFulfillmentEnabled()) {
      try {
        const fulfillment = await processOrderSupplierFulfillments(paidOrderId);
        console.info("[cj-fulfillment]", JSON.stringify({ event: "paid_order_fulfillment_attempted", orderId: paidOrderId, fulfillmentCount: fulfillment.length }));
      } catch (error) {
        // Buyer payment is already final. Supplier failure is persisted/recoverable and must not replay stock/payment effects.
        console.error("[cj-fulfillment]", JSON.stringify({ event: "paid_order_fulfillment_dispatch_failed", orderId: paidOrderId, error: error instanceof Error ? error.message : "FULFILLMENT_DISPATCH_FAILED" }));
      }
    } else if (paidOrderId) {
      console.info("[cj-fulfillment]", JSON.stringify({ event: "automatic_fulfillment_disabled", orderId: paidOrderId }));
    }
    if (sellerCheckout) {
      const updatedStoreId = "storeId" in result && typeof result.storeId === "string"
        ? result.storeId
        : initialRecord?.storeId;
      const updated = updatedStoreId
        ? await prisma.sellerSubscription.findUnique({
            where: { storeId: updatedStoreId },
            select: { id: true, storeId: true, status: true, stripeSubscriptionId: true, stripePriceId: true, currentPeriodEnd: true, store: { select: { status: true, stripeCustomerId: true } } },
          })
        : null;
      if (!updated || !["ACTIVE", "TRIALING"].includes(updated.status)) {
        throw new Error(`Subscription Checkout ${session.id} completed without an active local SellerSubscription update.`);
      }
      console.info(`[Stripe webhook ${event.id}] Post-processing database update result.`, updated);
    }
    console.info(`[Stripe webhook ${event.id}] Completed ${event.type}.`, result);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error(`[Stripe webhook ${event.id}] Processing failed for ${event.type}. Stripe should retry this event.`, error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}
