import { prisma } from "@/lib/prisma";
import { processStripeEvent } from "@/lib/payments";
import { type StripeCheckoutSession, type StripeEvent } from "@/lib/stripe";
import { handleStripeWebhookRequest } from "@/lib/stripe-webhook-request";
import { automaticCjFulfillmentEnabled, processOrderSupplierFulfillments } from "@/lib/suppliers/supplier-fulfillment";
import { dispatchNotificationPushBestEffort } from "@/lib/web-push-delivery";

export const runtime = "nodejs";

async function processAuthenticatedStripeEvent(event: StripeEvent) {
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
      console.info(`[Stripe webhook ${event.id}] Validated a subscription Checkout payload.`);
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
      console.info(`[Stripe webhook ${event.id}] Subscription lookup completed (found=${Boolean(initialRecord)}).`);
    }
    const result = await processStripeEvent(prisma, event);
    const paidOrderId = !sellerCheckout && "paid" in result && result.paid === true
      ? session.metadata?.orderId ?? session.client_reference_id
      : null;
    if(paidOrderId){const notification=await prisma.notification.findFirst({where:{type:"ORDER_PAID",href:`/account/orders/${paidOrderId}`},orderBy:{createdAt:"desc"},select:{id:true}});if(notification)dispatchNotificationPushBestEffort(notification.id);}
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
      console.info(`[Stripe webhook ${event.id}] Subscription state verified after processing.`);
    }
    console.info(`[Stripe webhook ${event.id}] Completed ${event.type}.`, result);
    return result;
}

export async function POST(request: Request) {
  return handleStripeWebhookRequest(request, { processEvent: processAuthenticatedStripeEvent });
}

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}
