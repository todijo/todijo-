import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { StripeInvoice, StripeInvoicePage } from "./stripe";

const CURSOR_PATTERN = /^in_[A-Za-z0-9]+$/;
const PAGE_SIZE = 100;

export type SellerInvoiceArchiveEntry = {
  id: string;
  number: string | null;
  createdAt: Date;
  amountPaid: number;
  currency: string;
  invoiceUrl: string;
};

export type SellerInvoiceArchivePage = {
  invoices: SellerInvoiceArchiveEntry[];
  nextCursor: string | null;
};

export class SellerInvoiceArchiveError extends Error {
  constructor(readonly code: "INVALID_CURSOR" | "INVOICE_PROVIDER_UNAVAILABLE") { super(code); }
}

export function safeStripeInvoiceUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["invoice.stripe.com", "pay.stripe.com"].includes(url.hostname)) return null;
    return url.toString();
  } catch { return null; }
}

function stripeCustomerId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

export async function loadSellerInvoiceArchive(input: {
  db: Pick<PrismaClient, "sellerBusiness">;
  ownerId: string;
  cursor?: string | null;
  listInvoices: (customerId: string, subscriptionId: string, cursor: string | null, limit: number) => Promise<StripeInvoicePage>;
}): Promise<SellerInvoiceArchivePage> {
  const cursor = input.cursor?.trim() || null;
  if (cursor && !CURSOR_PATTERN.test(cursor)) throw new SellerInvoiceArchiveError("INVALID_CURSOR");

  // Resolve only through the authenticated owner relationship. Deliberately do
  // not filter sellerClosedAt or the user's current role: former sellers keep
  // access to their historical documents from the same buyer account.
  const business = await input.db.sellerBusiness.findUnique({
    where: { ownerId: input.ownerId },
    select: { billingStore: { select: { stripeCustomerId: true, subscription: { select: { stripeSubscriptionId: true } } } } },
  });
  const customerId = business?.billingStore?.stripeCustomerId;
  const subscriptionId = business?.billingStore?.subscription?.stripeSubscriptionId;
  if (!customerId || !subscriptionId) return { invoices: [], nextCursor: null };

  let page: StripeInvoicePage;
  try { page = await input.listInvoices(customerId, subscriptionId, cursor, PAGE_SIZE); }
  catch { throw new SellerInvoiceArchiveError("INVOICE_PROVIDER_UNAVAILABLE"); }

  const invoices = page.data.flatMap((invoice: StripeInvoice) => {
    const invoiceCustomer = stripeCustomerId(invoice.customer);
    const invoiceSubscription = stripeCustomerId(invoice.subscription ?? invoice.parent?.subscription_details?.subscription);
    const invoiceUrl = safeStripeInvoiceUrl(invoice.hosted_invoice_url) ?? safeStripeInvoiceUrl(invoice.invoice_pdf);
    if (invoice.object !== "invoice" || invoice.paid !== true || invoice.status !== "paid" || invoiceCustomer !== customerId || invoiceSubscription !== subscriptionId || !invoiceUrl || !Number.isSafeInteger(invoice.created) || !Number.isSafeInteger(invoice.amount_paid) || !invoice.currency || !/^[A-Za-z]{3}$/.test(invoice.currency)) return [];
    return [{ id: invoice.id, number: invoice.number ?? null, createdAt: new Date(invoice.created! * 1000), amountPaid: invoice.amount_paid!, currency: invoice.currency.toUpperCase(), invoiceUrl }];
  });
  const last = page.data.at(-1);
  return { invoices, nextCursor: page.has_more && last?.id && CURSOR_PATTERN.test(last.id) ? last.id : null };
}
