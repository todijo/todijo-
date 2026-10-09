import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import BuyerDashboardLayout from "@/components/BuyerDashboardLayout";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { sellerInvoiceArchiveCopy } from "@/i18n/seller-invoice-archive";
import { listStripeCustomerInvoices } from "@/lib/stripe";
import { loadSellerInvoiceArchive } from "@/lib/seller-invoice-archive";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function formatInvoiceAmount(locale: string, amountPaid: number, currency: string) {
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountPaid / (10 ** fractionDigits));
}

export default async function SellerInvoiceArchivePage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ after?: string }>;
}) {
  const [{ locale }, query, session] = await Promise.all([params, searchParams, readSession()]);
  if (!session) redirect(`/${locale}/login?next=/${locale}/account/invoices`);
  if (session.role === "ADMIN") redirect(`/${locale}/dashboard`);

  const [copy, orders, compliance, auth] = await Promise.all([
    Promise.resolve(sellerInvoiceArchiveCopy(locale)),
    getTranslations("Orders"),
    getTranslations("Compliance"),
    getTranslations("Auth"),
  ]);
  let invoices: Awaited<ReturnType<typeof loadSellerInvoiceArchive>> | null = null;
  try {
    invoices = await loadSellerInvoiceArchive({
      db: prisma,
      ownerId: session.userId,
      cursor: query.after ?? null,
      listInvoices: (customerId, subscriptionId, cursor, limit) => listStripeCustomerInvoices({ customerId, subscriptionId, startingAfter: cursor, limit }),
    });
  } catch {
    // Keep the archive page useful when Stripe is unavailable; never leak provider diagnostics.
  }

  const content = <section className="sellerInvoiceArchive scopedPublicPage">
    <header className="sellerInvoiceArchiveHeader"><h1>{copy.title}</h1><p>{copy.intro}</p></header>
    {invoices === null ? <p className="sellerInvoiceArchiveEmpty" role="status">{auth("error")}</p> : invoices.invoices.length === 0 ? <p className="sellerInvoiceArchiveEmpty" role="status">{copy.empty}</p> : <>
      <section className="sellerInvoiceArchiveList" aria-label={copy.title}>
        {invoices.invoices.map((invoice) => <article className="sellerInvoiceArchiveCard" key={invoice.id}>
          <div><span>{compliance("transactionDate")}</span><strong>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(invoice.createdAt)}</strong></div>
          {invoice.number && <div><span>{compliance("invoiceReference")}</span><strong>{invoice.number}</strong></div>}
          <div><span>{compliance("transactionTotal")}</span><strong>{formatInvoiceAmount(locale, invoice.amountPaid, invoice.currency)}</strong></div>
          <a className="quickActionLink primary" href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer">{copy.open}</a>
        </article>)}
      </section>
      {invoices.nextCursor && <nav className="sellerInvoiceArchivePagination" aria-label={copy.title}><Link className="quickActionLink secondary" href={`/${locale}/account/invoices?after=${encodeURIComponent(invoices.nextCursor)}`}>{orders("next")}</Link></nav>}
    </>}
  </section>;

  if (session.role === "SELLER") {
    const owner = await prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true, store: { select: { slug: true } } } });
    if (!owner) redirect(`/${locale}/login`);
    return <SellerDashboardLayout locale={locale} storeSlug={owner.store?.slug} firstName={owner.firstName} lastName={owner.lastName} active="invoices">{content}</SellerDashboardLayout>;
  }
  return <BuyerDashboardLayout locale={locale} active="invoices">{content}</BuyerDashboardLayout>;
}
