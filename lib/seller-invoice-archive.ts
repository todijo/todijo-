import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { StripeInvoice, StripeInvoicePage } from "./stripe";

const CURSOR_PATTERN = /^in_[A-Za-z0-9]+$/;
const PAGE_SIZE = 100;

export type SellerInvoiceArchiveEntry = { id: string; number: string | null; createdAt: Date; amountPaid: number; currency: string; invoiceUrl: string };
export type SellerInvoiceArchivePage = { invoices: SellerInvoiceArchiveEntry[]; nextCursor: string | null };

export class SellerInvoiceArchiveError extends Error {
  constructor(readonly code: "INVALID_CURSOR" | "INVOICE_PROVIDER_UNAVAILABLE") { super(code); }
}

export function safeStripeInvoiceUrl(value: string | null | undefined) {
  if (!value) return null;
  try { const url = new URL(value); if (url.protocol !== "https:" || !["invoice.stripe.com", "pay.stripe.com"].includes(url.hostname)) return null; return url.toString(); }
  catch { return null; }
}

function objectId(value: string | { id: string } | null | undefined) { return typeof value === "string" ? value : value?.id ?? null; }

export async function loadSellerInvoiceArchive(input: {
  db: Pick<PrismaClient, "sellerBusiness" | "sellerBusinessInvoice">;
  ownerId: string;
  cursor?: string | null;
  listInvoices: (customerId: string, cursor: string | null, limit: number) => Promise<StripeInvoicePage>;
}): Promise<SellerInvoiceArchivePage> {
  const cursor = input.cursor?.trim() || null;
  if (cursor && !CURSOR_PATTERN.test(cursor)) throw new SellerInvoiceArchiveError("INVALID_CURSOR");
  // The stable billing customer is the business boundary. Subscription IDs can
  // change over time, so historical invoices must not be filtered to the live ID.
  const business = await input.db.sellerBusiness.findUnique({
    where: { ownerId: input.ownerId },
    select: { id: true, billingStore: { select: { stripeCustomerId: true } } },
  });
  const customerId = business?.billingStore?.stripeCustomerId;
  if (!business) return { invoices: [], nextCursor: null };
  const cursorRow = cursor ? await input.db.sellerBusinessInvoice.findUnique({ where: { stripeInvoiceId: cursor }, select: { businessId: true, createdAt: true } }) : null;
  if (cursor && cursorRow?.businessId !== business.id) throw new SellerInvoiceArchiveError("INVALID_CURSOR");
  const beforeCursor = cursorRow ? { OR: [{ createdAt: { lt: cursorRow.createdAt } }, { createdAt: cursorRow.createdAt, stripeInvoiceId: { lt: cursor! } }] } : undefined;
  const archived = await input.db.sellerBusinessInvoice.findMany({
    where: { businessId: business.id, ...(beforeCursor ?? {}) },
    orderBy: [{ createdAt: "desc" }, { stripeInvoiceId: "desc" }], take: PAGE_SIZE + 1,
  });
  let page: StripeInvoicePage | null = null;
  if (customerId) {
    try { page = await input.listInvoices(customerId, cursor, PAGE_SIZE); }
    catch { if (!archived.length) throw new SellerInvoiceArchiveError("INVOICE_PROVIDER_UNAVAILABLE"); }
  }

  const remoteRecords = (page?.data ?? []).flatMap((invoice: StripeInvoice) => {
    const invoiceCustomer = objectId(invoice.customer);
    const invoiceUrl = safeStripeInvoiceUrl(invoice.hosted_invoice_url) ?? safeStripeInvoiceUrl(invoice.invoice_pdf);
    const subscriptionId = objectId(invoice.subscription ?? invoice.parent?.subscription_details?.subscription);
    if (invoice.object !== "invoice" || invoice.paid !== true || invoice.status !== "paid" || invoiceCustomer !== customerId || !subscriptionId || !invoiceUrl || !Number.isSafeInteger(invoice.created) || !Number.isSafeInteger(invoice.amount_paid) || !invoice.currency || !/^[A-Za-z]{3}$/.test(invoice.currency)) return [];
    return [{ entry: { id: invoice.id, number: invoice.number ?? null, createdAt: new Date(invoice.created! * 1000), amountPaid: invoice.amount_paid!, currency: invoice.currency.toUpperCase(), invoiceUrl }, record: { businessId: business.id, stripeInvoiceId: invoice.id, sourceEventId: null, stripeCustomerId: customerId!, stripeSubscriptionId: subscriptionId, invoiceNumber: invoice.number ?? null, createdAt: new Date(invoice.created! * 1000), amountPaidMinor: BigInt(invoice.amount_paid!), currency: invoice.currency.toUpperCase(), hostedInvoiceUrl: invoice.hosted_invoice_url ?? null, invoicePdfUrl: invoice.invoice_pdf ?? null } }];
  });
  if (remoteRecords.length) await input.db.sellerBusinessInvoice.createMany({ data: remoteRecords.map((record) => record.record), skipDuplicates: true });
  const byId = new Map(remoteRecords.map(({ entry }) => [entry.id, entry]));
  for (const invoice of archived.slice(0, PAGE_SIZE)) {
    const invoiceUrl = safeStripeInvoiceUrl(invoice.hostedInvoiceUrl) ?? safeStripeInvoiceUrl(invoice.invoicePdfUrl);
    const amountPaid = Number(invoice.amountPaidMinor);
    if (!invoiceUrl || !Number.isSafeInteger(amountPaid) || amountPaid < 0 || !/^[A-Z]{3}$/.test(invoice.currency)) continue;
    byId.set(invoice.stripeInvoiceId, { id: invoice.stripeInvoiceId, number: invoice.invoiceNumber, createdAt: invoice.createdAt, amountPaid, currency: invoice.currency, invoiceUrl });
  }
  const invoices = [...byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id)).slice(0, PAGE_SIZE);
  const last = invoices.at(-1)?.id;
  const more = Boolean(page?.has_more || archived.length > PAGE_SIZE);
  return { invoices, nextCursor: more && last && CURSOR_PATTERN.test(last) ? last : null };
}
