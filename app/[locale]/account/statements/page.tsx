import { redirect } from "next/navigation";
import BuyerDashboardLayout from "@/components/BuyerDashboardLayout";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { sellerPrincipals } from "@/lib/seller-business-access";
import { createSellerMonthlyStatementRevisions } from "@/lib/seller-monthly-statements";
import { sellerMonthlyStatementCopy } from "@/i18n/seller-monthly-statements";

export const dynamic = "force-dynamic";

export default async function SellerMonthlyStatementsPage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, session] = await Promise.all([params, readSession()]);
  if (!session) redirect(`/${locale}/login?next=/${locale}/account/statements`);
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, firstName: true, lastName: true, ownedBusiness: { select: { id: true, sellerClosedAt: true, stores: { select: { id: true, name: true, businessId: true } } } }, store: { select: { slug: true } } } });
  if (!user || user.role === "ADMIN") redirect(`/${locale}/dashboard`);
  const principals = await sellerPrincipals(prisma, session.userId);
  const businessIds = [...new Set([...principals.map((principal) => principal.businessId), ...(user.ownedBusiness?.sellerClosedAt ? [user.ownedBusiness.id] : [])])];
  const businesses = businessIds.length ? await prisma.sellerBusiness.findMany({ where: { id: { in: businessIds } }, select: { id: true, ownerId: true, sellerClosedAt: true, stores: { select: { id: true, name: true, businessId: true } } } }) : [];
  const stores = businesses.flatMap((business) => {
    const principal = principals.find((item) => item.businessId === business.id);
    const isClosedOwner = Boolean(business.sellerClosedAt && business.ownerId === session.userId);
    return business.stores.filter((store) => principal?.owner || (principal?.storeIds.includes(store.id) && principal.permissions.includes("SALES_VIEW")) || isClosedOwner).map((store) => ({ ...store, businessClosed: Boolean(business.sellerClosedAt) }));
  });
  for (const store of stores) {
    if (!store.businessClosed) {
      try { await createSellerMonthlyStatementRevisions(prisma, { businessId: store.businessId!, storeId: store.id }); }
      catch { /* An unavailable ledger does not erase or replace finalized statements. */ }
    }
  }
  const statements = stores.length ? await prisma.sellerMonthlyStatement.findMany({ where: { businessId: { in: businesses.map((business) => business.id) }, storeId: { in: stores.map((store) => store.id) } }, orderBy: [{ year: "desc" }, { month: "desc" }, { currency: "asc" }, { revision: "desc" }], select: { id: true, storeId: true, year: true, month: true, currency: true, revision: true, rowCount: true } }) : [];
  const copy = sellerMonthlyStatementCopy(locale);
  const content = <section className="sellerInvoiceArchive scopedPublicPage">
    <header className="sellerInvoiceArchiveHeader"><h1>{copy.title}</h1></header>
    {!statements.length ? <p className="sellerInvoiceArchiveEmpty" role="status">{copy.empty}</p> : <section className="sellerInvoiceArchiveList" aria-label={copy.title}>
      {statements.map((statement) => <article className="sellerInvoiceArchiveCard" key={statement.id}>
        <div><span>{copy.period}</span><strong>{`${statement.year}-${String(statement.month).padStart(2, "0")}`}</strong></div>
        <div><span>{stores.find((store) => store.id === statement.storeId)?.name}</span><strong>{statement.currency} · {copy.revision.replace("{revision}", String(statement.revision))}</strong></div>
        <a className="quickActionLink primary" href={`/api/seller/statements/${encodeURIComponent(statement.id)}?locale=${encodeURIComponent(locale)}`}>{copy.download}</a>
      </article>)}
    </section>}
  </section>;
  if (user.role === "SELLER") return <SellerDashboardLayout locale={locale} storeSlug={user.store?.slug} firstName={user.firstName} lastName={user.lastName} active="statements">{content}</SellerDashboardLayout>;
  return <BuyerDashboardLayout locale={locale} active="statements">{content}</BuyerDashboardLayout>;
}
