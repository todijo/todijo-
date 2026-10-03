import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { assertSellerActivity } from "@/lib/account-status";
import { AdminAccessError } from "@/lib/admin-access";
import { requireBusinessOwner, SellerCapabilityError } from "@/lib/seller-business-access";
import { requestSellerSubscriptionChange, SellerSubscriptionChangeError } from "@/lib/seller-subscription-changes";
import { retrieveStripeInvoice } from "@/lib/stripe";

async function paymentUrl(invoiceId: string | null, subscriptionId: string) {
  if (!invoiceId) return null;
  const invoice = await retrieveStripeInvoice(invoiceId);
  if (invoice.paid || (invoice.subscription ?? invoice.parent?.subscription_details?.subscription) !== subscriptionId || !invoice.hosted_invoice_url) return null;
  const url = new URL(invoice.hosted_invoice_url);
  return url.protocol === "https:" && ["invoice.stripe.com", "pay.stripe.com"].includes(url.hostname) ? url.toString() : null;
}

export async function GET() {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    const principal = await requireBusinessOwner(prisma, session.userId);
    await assertSellerActivity(prisma, session.userId);
    const business = await prisma.sellerBusiness.findUniqueOrThrow({ where: { id: principal.businessId }, select: { billingStoreId: true } });
    if (!business.billingStoreId) return NextResponse.json({ error: "STORE_REQUIRED" }, { status: 403 });
    const change = await prisma.sellerSubscriptionChange.findFirst({ where: { sellerSubscription: { storeId: business.billingStoreId, store: { ownerId: session.userId } }, status: "AWAITING_PAYMENT", operation: "UPGRADE" } });
    return NextResponse.json({ paymentUrl: change ? await paymentUrl(change.stripeInvoiceId, change.stripeSubscriptionId) : null });
  } catch (error) {
    if (error instanceof SellerCapabilityError || error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "CHANGE_RECONCILIATION_REQUIRED" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    const principal = await requireBusinessOwner(prisma, session.userId);
    await assertSellerActivity(prisma, session.userId);
    const business = await prisma.sellerBusiness.findUniqueOrThrow({ where: { id: principal.businessId }, select: { billingStoreId: true } });
    if (!business.billingStoreId) return NextResponse.json({ error: "STORE_REQUIRED" }, { status: 403 });
    const body = await request.json();
    if (!["change", "cancel"].includes(body.action)) return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
    const change = await requestSellerSubscriptionChange({ db: prisma, storeId: business.billingStoreId, userId: session.userId,
      planId: body.planId, interval: body.interval, cancelSchedule: body.action === "cancel" });
    return NextResponse.json({ id: change.id, status: change.status, effectiveAt: change.effectiveAt, paymentUrl: change.status === "AWAITING_PAYMENT" ? await paymentUrl(change.stripeInvoiceId, change.stripeSubscriptionId) : null });
  } catch (error) {
    if (error instanceof SellerSubscriptionChangeError || error instanceof SellerCapabilityError || error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Seller subscription change requires reconciliation", error);
    return NextResponse.json({ error: "CHANGE_RECONCILIATION_REQUIRED" }, { status: 503 });
  }
}
