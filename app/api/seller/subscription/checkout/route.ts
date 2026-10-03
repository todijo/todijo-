import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { configuredSellerPlan } from "@/lib/seller-plans";
import { createStripeCustomer } from "@/lib/stripe";
import {createOrReuseSellerSubscriptionCheckout,hasCurrentSellerSubscriptionEntitlement,SellerSubscriptionCheckoutError} from "@/lib/seller-subscription-checkout";
import { assertSellerActivity } from "@/lib/account-status";
import { AdminAccessError } from "@/lib/admin-access";
import { requireBusinessOwner, SellerCapabilityError } from "@/lib/seller-business-access";
import { defaultLocale, isLocale } from "@/i18n/config";

export async function POST(request: Request) {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const principal=await requireBusinessOwner(prisma,session.userId);
    await assertSellerActivity(prisma,session.userId);
    const body = await request.json();
    const plan = configuredSellerPlan(body.planId, body.interval);
    const locale=isLocale(body.locale)?body.locale:defaultLocale;
    if (!plan) return NextResponse.json({ error: "Invalid or unavailable subscription plan." }, { status: 400 });
    const store = await prisma.store.findFirst({
      where: { id:(await prisma.sellerBusiness.findUnique({where:{id:principal.businessId},select:{billingStoreId:true}}))?.billingStoreId??undefined,ownerId:session.userId },
      select: { id: true, name: true, contactEmail: true, stripeCustomerId: true, subscription: { select: { status: true, plan:true,currentPeriodEnd:true } } },
    });
    if (!store) return NextResponse.json({ error: "Create your store first." }, { status: 403 });
    if (hasCurrentSellerSubscriptionEntitlement(store.subscription)) {
      return NextResponse.json({ error: "This store already has an active subscription." }, { status: 409 });
    }
    let customerId = store.stripeCustomerId;
    if (!customerId) {
      console.info(`[Seller subscription] Creating Stripe customer for store ${store.id}.`);
      customerId = (await createStripeCustomer({ storeId: store.id, userId: session.userId, email: store.contactEmail, name: store.name })).id;
      await prisma.store.update({ where: { id: store.id }, data: { stripeCustomerId: customerId } });
      console.info(`[Seller subscription] Saved Stripe customer ${customerId} for store ${store.id}.`);
    }
    const checkout=await createOrReuseSellerSubscriptionCheckout({db:prisma,storeId:store.id,userId:session.userId,customerId,locale,plan:{id:plan.id,interval:plan.interval,priceId:plan.priceId}});
    console.info(`[Seller subscription] Created Checkout session ${checkout.id} for store ${store.id}.`);
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if(error instanceof SellerSubscriptionCheckoutError)return NextResponse.json({error:error.code},{status:error.status});
    if(error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status});
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Seller subscription checkout failed", error);
    return NextResponse.json({ error: "Unable to start subscription checkout." }, { status: 500 });
  }
}
