import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import { activeAccessSource, requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const locale = await getLocale();
  const [t, ordersText] = await Promise.all([getTranslations("Admin"), getTranslations("Orders")]);
  const session = await readSession();
  if (!session) redirect(`/${locale}/login`);
  try {
    await requireAdmin(prisma, session);
  } catch {
    redirect(`/${locale}/dashboard`);
  }

  const now = new Date();
  const [users, stores] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true, role: true, store: { select: { id: true } } },
    }),
    prisma.store.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, slug: true, status: true,
        owner: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        subscription: { select: { status: true, currentPeriodEnd: true } },
        accessGrants: { orderBy: { createdAt: "desc" }, select: { source: true, startsAt: true, endsAt: true } },
        _count: { select: { products: true } },
      },
    }),
  ]);
  const serializedStores = stores.map((store) => {
    const access = activeAccessSource(store, now);
    return {
      id: store.id, name: store.name, slug: store.slug, status: store.status,
      owner: store.owner, productCount: store._count.products,
      accessSource: access.source, expiresAt: access.expiresAt?.toISOString() ?? null,
      stripeStatus: store.subscription?.status ?? null,
    };
  });

  return <main className="adminPage">
    <SiteHeader />
    <section className="adminShell">
      <header className="adminHero">
        <div><span>{t("eyebrow")}</span><h1>{t("title")}</h1><p>{t("intro")}</p></div>
        <div><a href={`/${locale}/seller/products`}>{t("manageOwnProducts")}</a><Link href="/adm-barewbar-182203/orders">{ordersText("history.adminTitle")}</Link><Link href="/adm-barewbar-182203/buyers">{t("buyersTitle")}</Link><Link href="/adm-barewbar-182203/sellers">{t("sellersTitle")}</Link></div>
      </header>
      <AdminDashboard
        adminId={session.userId}
        locale={locale}
        users={users.map((user) => ({ ...user, hasStore: Boolean(user.store), store: undefined }))}
        stores={serializedStores}
      />
    </section>
    <MarketplaceFooter />
  </main>;
}
