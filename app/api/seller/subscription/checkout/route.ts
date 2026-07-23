import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { configuredSellerPlan } from "@/lib/seller-plans";
import { createSellerSubscriptionCheckout, createStripeCustomer } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const plan = configuredSellerPlan((await request.json()).planId);
    if (!plan) return NextResponse.json({ error: "Invalid or unavailable subscription plan." }, { status: 400 });
    const store = await prisma.store.findUnique({
      where: { ownerId: session.userId },
      select: { id: true, name: true, contactEmail: true, stripeCustomerId: true, subscription: { select: { status: true, stripePriceId: true } } },
    });
    if (!store) return NextResponse.json({ error: "Create your store first." }, { status: 403 });
    if (store.subscription && ["ACTIVE", "TRIALING"].includes(store.subscription.status)) {
      return NextResponse.json({ error: "This store already has an active subscription." }, { status: 409 });
    }
    let customerId = store.stripeCustomerId;
    if (!customerId) {
      console.info(`[Seller subscription] Creating Stripe customer for store ${store.id}.`);
      customerId = (await createStripeCustomer({ storeId: store.id, userId: session.userId, email: store.contactEmail, name: store.name })).id;
      await prisma.store.update({ where: { id: store.id }, data: { stripeCustomerId: customerId } });
      console.info(`[Seller subscription] Saved Stripe customer ${customerId} for store ${store.id}.`);
    }
    await prisma.sellerSubscription.upsert({
      where: { storeId: store.id },
      create: { storeId: store.id, stripePriceId: plan.priceId, plan: plan.id, status: "INCOMPLETE" },
      update: { stripePriceId: plan.priceId, plan: plan.id, status: "INCOMPLETE" },
    });
    console.info(`[Seller subscription] Prepared ${plan.id} subscription record for store ${store.id} with price ${plan.priceId}.`);
    const checkout = await createSellerSubscriptionCheckout({ storeId: store.id, userId: session.userId, customerId, priceId: plan.priceId, plan: plan.id });
    console.info(`[Seller subscription] Created Checkout session ${checkout.id} for store ${store.id}.`);
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Seller subscription checkout failed", error);
    return NextResponse.json({ error: "Unable to start subscription checkout." }, { status: 500 });
  }
}
