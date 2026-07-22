import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BarChart3, Boxes, CircleDollarSign, CreditCard, Heart, Home, MapPin, MessageCircle, Package, Plus, ReceiptText, Settings, ShoppingBag, ShoppingCart, Star, Store, TrendingUp, Truck, Users } from "lucide-react";
import { DashboardEmptyState, DashboardHeader, DashboardQuickAction, DashboardSection, DashboardSidebar, DashboardStatCard, DashboardStatusBadge, type DashboardNavItem } from "@/components/DashboardUI";
import StripeConnectSection from "@/components/StripeConnectSection";
import { buyerPaymentState, listBuyerOrders, type BuyerOrder } from "@/lib/buyer-orders";
import { dashboardAudience, dashboardPaths } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function money(locale: string, amount: number, currency: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

function RecentOrder({ order, locale, detailsLabel, unknownStore, statusLabel }: { order: BuyerOrder; locale: string; detailsLabel: string; unknownStore: string; statusLabel: string }) {
  const item = order.items[0];
  return <article className="premiumRecentOrder">
    <div className="premiumRecentImage">{item?.product.images[0] ? <Image src={item.product.images[0]} alt="" width={68} height={68} unoptimized /> : <Package size={26} aria-hidden="true"/>}</div>
    <div className="premiumRecentProduct"><strong>{item?.product.name ?? `#${order.id.slice(-8)}`}</strong><span>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(order.createdAt)} · {item?.product.store.name ?? unknownStore}</span></div>
    <DashboardStatusBadge label={statusLabel} status={order.status}/>
    <strong className="premiumRecentTotal">{money(locale, Number(order.total), order.currency)}</strong>
    <Link className="premiumTextLink" href={`/${locale}/account/orders/${order.id}`}>{detailsLabel}</Link>
  </article>;
}

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const p = await getTranslations("DashboardPremium");
  const common = await getTranslations("Common");
  const ordersText = await getTranslations("Orders");
  const locale = await getLocale();
  const session = await readSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      firstName: true, lastName: true, email: true, role: true,
      stripeAccountId: true, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true,
      store: { select: { name: true, slug: true, country: true, city: true, currency: true, _count: { select: { products: true } } } },
      _count: { select: { orders: true, buyerConversations: true, reviews: true } },
    },
  });
  if (!user) redirect("/login");

  const isSeller = dashboardAudience(user.role) === "seller";
  const paths = dashboardPaths(locale);
  const homeHref = paths.home;
  const buyerOrdersHref = paths.orders;
  const buyerNav: DashboardNavItem[] = [
    { label: p("nav.dashboard"), href: paths.dashboard, icon: Home, active: true },
    { label: p("nav.orders"), href: buyerOrdersHref, icon: ReceiptText },
    { label: p("nav.messages"), href: paths.messages, icon: MessageCircle },
    { label: p("nav.favorites"), href: `/${locale}/dashboard#favorites`, icon: Heart },
    { label: p("nav.addresses"), href: `/${locale}/dashboard#addresses`, icon: MapPin },
    { label: p("nav.payments"), href: `/${locale}/dashboard#payments`, icon: CreditCard },
    { label: p("nav.reviews"), href: `/${locale}/dashboard#reviews`, icon: Star },
    { label: p("nav.settings"), href: `/${locale}/dashboard#settings`, icon: Settings },
  ];
  const sellerNav: DashboardNavItem[] = [
    { label: p("nav.dashboard"), href: paths.dashboard, icon: Home, active: true },
    { label: p("nav.products"), href: `/${locale}/seller/products`, icon: Boxes },
    { label: p("nav.orders"), href: `/${locale}/dashboard#recent-orders`, icon: ReceiptText },
    { label: p("nav.messages"), href: paths.messages, icon: MessageCircle },
    { label: p("nav.statistics"), href: `/${locale}/dashboard#statistics`, icon: BarChart3 },
    { label: p("nav.revenue"), href: `/${locale}/dashboard#statistics`, icon: CircleDollarSign },
    { label: p("nav.reviews"), href: user.store ? `/${locale}/store/${user.store.slug}#reviews` : `/${locale}/dashboard`, icon: Star },
    { label: p("nav.store"), href: user.store ? `/${locale}/store/${user.store.slug}` : `/${locale}/seller/create-store`, icon: Store },
    { label: p("nav.settings"), href: `/${locale}/seller/store-settings`, icon: Settings },
  ];

  if (!isSeller) {
    const orders = await listBuyerOrders(prisma, session.userId);
    const pending = orders.filter((order) => ["PENDING", "PAID", "PROCESSING", "SHIPPED"].includes(order.status)).length;
    const delivered = orders.filter((order) => order.status === "DELIVERED").length;
    const spentByCurrency = orders.filter((order) => buyerPaymentState(order) === "paid").reduce<Record<string, number>>((totals, order) => { totals[order.currency] = (totals[order.currency] ?? 0) + Number(order.total); return totals; }, {});
    const spent = Object.entries(spentByCurrency).map(([currency, total]) => money(locale, total, currency)).join(" · ") || money(locale, 0, "EUR");
    return <main className="premiumDashboard premiumBuyerDashboard">
      <DashboardSidebar items={buyerNav} homeHref={homeHref} logoutLabel={common("logout")}/>
      <div className="premiumDashboardMain">
        <DashboardHeader firstName={user.firstName} lastName={user.lastName} eyebrow={p("buyer.eyebrow")} notificationLabel={p("notifications")}/>
        <div className="premiumDashboardContent">
          <section className="premiumWelcomeHero"><div><span>{p("buyer.badge")}</span><h1>{p("welcome", { name: user.firstName })}</h1><p>{p("buyer.intro")}</p></div><Link href={homeHref}>{p("browseMarketplace")} <ShoppingBag size={18}/></Link></section>
          <section className="premiumStatsGrid">
            <DashboardStatCard label={p("stats.totalOrders")} value={orders.length} href={buyerOrdersHref} icon={ReceiptText}/>
            <DashboardStatCard label={p("stats.pendingOrders")} value={pending} href={buyerOrdersHref} icon={Package} tone="amber"/>
            <DashboardStatCard label={p("stats.deliveredOrders")} value={delivered} href={buyerOrdersHref} icon={Truck} tone="blue"/>
            <DashboardStatCard label={p("stats.totalSpent")} value={spent} icon={CreditCard} tone="mint"/>
          </section>
          <div className="premiumDashboardColumns">
            <DashboardSection id="recent-orders" title={p("recentOrders")} description={p("buyer.recentDescription")} action={<Link className="premiumTextLink" href={buyerOrdersHref}>{p("viewAll")}</Link>}>
              {orders.length
                ? <div className="premiumRecentOrders">{orders.slice(0, 4).map((order) => <RecentOrder key={order.id} order={order} locale={locale} detailsLabel={ordersText("details")} unknownStore={ordersText("unknownStore")} statusLabel={ordersText(`status.${order.status}`)}/>)}</div>
                : <DashboardEmptyState title={p("buyer.emptyOrders")} description={p("buyer.emptyOrdersText")} action={<Link className="premiumPrimaryButton" href={homeHref}>{p("browseProducts")}</Link>}/>
              }
            </DashboardSection>
            <DashboardSection title={p("quickActions")}><div className="premiumQuickGrid"><DashboardQuickAction label={p("browseProducts")} href={homeHref} icon={ShoppingBag} primary/><DashboardQuickAction label={p("myOrders")} href={buyerOrdersHref} icon={ReceiptText}/><DashboardQuickAction label={p("myMessages")} href={paths.messages} icon={MessageCircle}/><DashboardQuickAction label={p("myCart")} href={paths.cart} icon={ShoppingCart}/></div></DashboardSection>
          </div>
          <section className="premiumDiscoveryBanner"><div><span>{p("discoverBadge")}</span><h2>{p("discoverTitle")}</h2><p>{p("discoverText")}</p></div><Link href={homeHref}>{p("exploreNow")}</Link></section>
        </div>
      </div>
    </main>;
  }

  if (!user.store) return <main className="premiumDashboard premiumSellerDashboard"><DashboardSidebar items={sellerNav} homeHref={homeHref} logoutLabel={common("logout")} seller/><div className="premiumDashboardMain"><DashboardHeader firstName={user.firstName} lastName={user.lastName} eyebrow={p("seller.eyebrow")} notificationLabel={p("notifications")}/><div className="premiumDashboardContent"><DashboardEmptyState title={t("openShop")} description={t("openShopText")} action={<Link className="premiumPrimaryButton" href={`/${locale}/seller/create-store`}>{t("createShop")}</Link>}/><StripeConnectSection initialStatus={{ connected: Boolean(user.stripeAccountId), onboardingComplete: user.stripeOnboardingComplete, chargesEnabled: user.stripeChargesEnabled, payoutsEnabled: user.stripePayoutsEnabled }}/></div></div></main>;

  const sellerOrders = await prisma.order.findMany({ where: { items: { some: { product: { store: { ownerId: session.userId } } } } }, include: { items: { include: { product: { select: { name: true, images: true, store: { select: { name: true, slug: true } } } } } } }, orderBy: { createdAt: "desc" } });
  const paidSellerOrders = sellerOrders.filter((order) => order.paidAt || order.stripePaymentIntentId);
  const revenue = paidSellerOrders.reduce((sum, order) => sum + (order.sellerAmount ?? 0) / 100, 0);
  const customers = new Set(paidSellerOrders.map((order) => order.buyerId)).size;
  const monthly = Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - (5 - index)); return { key: `${date.getFullYear()}-${date.getMonth()}`, label: new Intl.DateTimeFormat(locale, { month: "short" }).format(date), value: 0 }; });
  for (const order of paidSellerOrders) { const key = `${order.createdAt.getFullYear()}-${order.createdAt.getMonth()}`; const point = monthly.find((item) => item.key === key); if (point) point.value += (order.sellerAmount ?? 0) / 100; }
  const maxRevenue = Math.max(...monthly.map((item) => item.value), 0);
  return <main className="premiumDashboard premiumSellerDashboard">
    <DashboardSidebar items={sellerNav} homeHref={homeHref} logoutLabel={common("logout")} seller/>
    <div className="premiumDashboardMain"><DashboardHeader firstName={user.firstName} lastName={user.lastName} eyebrow={p("seller.eyebrow")} notificationLabel={p("notifications")}/><div className="premiumDashboardContent">
      <section className="premiumWelcomeHero isSeller"><div><span>{p("seller.badge")}</span><h1>{p("welcome", { name: user.firstName })}</h1><p>{t("shop", { name: user.store.name, city: user.store.city, country: user.store.country })}</p></div><Link href={`/${locale}/store/${user.store.slug}`}>{t("viewShop")} <Store size={18}/></Link></section>
      <section className="premiumStatsGrid"><DashboardStatCard label={p("nav.products")} value={user.store._count.products} href={`/${locale}/seller/products`} icon={Boxes}/><DashboardStatCard label={p("stats.orders")} value={sellerOrders.length} href={`/${locale}/dashboard#recent-orders`} icon={ReceiptText} tone="blue"/><DashboardStatCard label={p("nav.revenue")} value={money(locale, revenue, user.store.currency)} href={`/${locale}/dashboard#statistics`} icon={TrendingUp} tone="mint"/><DashboardStatCard label={p("stats.customers")} value={customers} icon={Users} tone="amber"/></section>
      <div className="premiumDashboardColumns sellerColumns"><DashboardSection id="recent-orders" title={p("recentOrders")} description={p("seller.recentDescription")}>
        {sellerOrders.length
          ? <div className="premiumRecentOrders">{sellerOrders.slice(0, 5).map((order) => <article className="premiumRecentOrder" key={order.id}><div className="premiumRecentImage">{order.items[0]?.product.images[0] ? <Image src={order.items[0].product.images[0]} alt="" width={68} height={68} unoptimized/> : <Package size={26}/>}</div><div className="premiumRecentProduct"><strong>{order.items[0]?.product.name ?? `#${order.id.slice(-8)}`}</strong><span>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(order.createdAt)}</span></div><DashboardStatusBadge label={ordersText(`status.${order.status}`)} status={order.status}/><strong className="premiumRecentTotal">{money(locale, Number(order.total), order.currency)}</strong></article>)}</div>
          : <DashboardEmptyState title={p("seller.emptyOrders")} description={p("seller.emptyOrdersText")}/>
        }
      </DashboardSection><DashboardSection title={p("quickActions")}><div className="premiumQuickGrid"><DashboardQuickAction label={t("addProduct")} href={`/${locale}/seller/products/new`} icon={Plus} primary/><DashboardQuickAction label={p("viewOrders")} href={`/${locale}/dashboard#recent-orders`} icon={ReceiptText}/><DashboardQuickAction label={p("myMessages")} href={paths.messages} icon={MessageCircle}/><DashboardQuickAction label={p("viewRevenue")} href={`/${locale}/dashboard#statistics`} icon={BarChart3}/></div></DashboardSection></div>
      <DashboardSection id="statistics" title={p("revenueOverview")} description={p("revenueDescription")}>
        {maxRevenue > 0
          ? <div className="premiumRevenueChart" aria-label={p("revenueOverview")}>{monthly.map((point) => <div key={point.key}><span style={{ height: `${Math.max(8, point.value / maxRevenue * 100)}%` }} title={money(locale, point.value, user.store!.currency)}/><small>{point.label}</small></div>)}</div>
          : <DashboardEmptyState title={p("noRevenue")} description={p("noRevenueText")}/>
        }
      </DashboardSection>
      <StripeConnectSection initialStatus={{ connected: Boolean(user.stripeAccountId), onboardingComplete: user.stripeOnboardingComplete, chargesEnabled: user.stripeChargesEnabled, payoutsEnabled: user.stripePayoutsEnabled }}/>
    </div></div>
  </main>;
}
