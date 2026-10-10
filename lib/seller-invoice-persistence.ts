import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { StripeInvoice } from "./stripe";

function id(value: string | { id: string } | null | undefined) { return typeof value === "string" ? value : value?.id ?? null; }

/** Store only Stripe-confirmed paid subscription invoices for the stable business billing customer. */
export async function persistPaidSellerInvoice(db: Pick<PrismaClient, "store" | "sellerBusinessInvoice">, event: { id: string }, value: StripeInvoice) {
  const optional = db as PrismaClient & { sellerBusinessInvoice?: PrismaClient["sellerBusinessInvoice"] };
  if (!optional.sellerBusinessInvoice || !db.store?.findFirst) return false;
  const customerId = id(value.customer);
  const subscriptionId = id(value.subscription ?? value.parent?.subscription_details?.subscription);
  if (value.object !== "invoice" || value.paid !== true || value.status !== "paid" || !value.id || !customerId || !subscriptionId
    || !Number.isSafeInteger(value.created) || !Number.isSafeInteger(value.amount_paid) || value.amount_paid! < 0
    || !value.currency || !/^[A-Za-z]{3}$/.test(value.currency)) return false;
  const store = await db.store.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true, businessId: true, business: { select: { billingStoreId: true } } } });
  // A random store customer or a non-billing store is not sufficient authority
  // to attach subscription invoices to a business archive.
  if (!store?.businessId || store.business?.billingStoreId !== store.id) return false;
  await optional.sellerBusinessInvoice.upsert({
    where: { stripeInvoiceId: value.id },
    create: {
      businessId: store.businessId,
      stripeInvoiceId: value.id,
      sourceEventId: event.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      invoiceNumber: value.number ?? null,
      createdAt: new Date(value.created! * 1000),
      amountPaidMinor: BigInt(value.amount_paid!),
      currency: value.currency.toUpperCase(),
      hostedInvoiceUrl: value.hosted_invoice_url ?? null,
      invoicePdfUrl: value.invoice_pdf ?? null,
    },
    // First verified Stripe record remains the immutable archive snapshot.
    update: {},
  });
  return true;
}
