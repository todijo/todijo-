import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Boxes, CreditCard, Home, MessageCircle, Package, Plus, ReceiptText, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Star, Store, TrendingUp, Truck, Users } from "lucide-react";
import { DashboardEmptyState, DashboardHeader, DashboardQuickAction, DashboardSection, DashboardSidebar, DashboardStatCard, DashboardStatusBadge, type DashboardNavItem } from "@/components/DashboardUI";
import StripeConnectSection from "@/components/StripeConnectSection";
import { buyerPaymentState, listBuyerOrders, type BuyerOrder } from "@/lib/buyer-orders";
import { dashboardAudience, dashboardPaths } from "@/lib/dashboard";
import { sellerOrderHistoryWhere } from "@/lib/order-history";
import { prisma } from "@/lib/prisma";
import { comparisonPercent, sellerAnalytics, sellerPeriodMetrics } from "@/lib/seller-dashboard";
import { readSession } from "@/lib/session";
import SellerAnalytics from "@/components/SellerAnalytics";
import { SellerFulfillmentControl } from "@/components/SellerFulfillmentControl";
import { fulfillmentStepFor, sellerFulfillmentActionFor } from "@/lib/order-status";
import { canPublish } from "@/lib/seller-subscription";
import { sellerDashboardNavItems } from "@/components/SellerDashboardLayout";

export const dynamic = "force-dynamic";
const DASHBOARD_DATA_TIMEOUT_MS = 15_000;

function dashboardData<T>(query: PromiseLike<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Dashboard data request timed out")), DASHBOARD_DATA_TIMEOUT_MS);
    Promise.resolve(query).then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error) => { clearTimeout(timeout); reject(error); },
    );
  });
}

function money(locale: string, amount: number, currency: string) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(safeAmount);
  } catch {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(safeAmount);
  }
}

function RecentOrder({ order, locale, detailsLabel, unknownStore, statusLabel }: { order: BuyerOrder; locale: string; detailsLabel: string; unknownStore: string; statusLabel: string }) {
  const item = order.items[0];
  return <article className="premiumRecentOrder">
    <div className="premiumRecentImage">{item?.product.images[0] ? <Image src={item.product.images[0]} alt="" width={68} height={68} unoptimized /> : <Package size={26} aria-hidden="true"/>}</div>
    <div className="premiumRecentProduct"><strong>{item?.product.name ?? detailsLabel}</strong><span>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(order.createdAt)} · {item?.product.store.name ?? unknownStore}</span></div>
    <DashboardStatusBadge label={statusLabel} status={order.status}/>
    <strong className="premiumRecentTotal">{money(locale, Number(order.total), order.currency)}</strong>
    <Link className="premiumTextLink" href={`/${locale}/account/orders/${order.id}`}>{detailsLabel}</Link>
  </article>;
}

export default async function DashboardPage() {
  const [t, p, s, common, ordersText, control, privacy, transparency, compliance, auth, locale, session] = await Promise.all([
    getTranslations("Dashboard"), getTranslations("DashboardPremium"), getTranslations("SellerDashboard"),
    getTranslations("Common"), getTranslations("Orders"), getTranslations("SellerControl"),
    getTranslations("Privacy"), getTranslations("SellerTransparency"), getTranslations("Compliance"), getTranslations("Auth"),
    getLocale(), readSession(),
  ]);
  if (!session) redirect("/login");

  const user = await dashboardData(prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      firstName: true, lastName: true, email: true, role: true,
      stripeAccountId: true, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true,
      store: { select: { id: true, name: true, slug: true, description: true, logo: true, banner: true, country: true, city: true, currency: true, status: true, sellerType: true, vatStatus: true, subscription: { select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true } }, accessGrants: { select: { source: true, startsAt: true, endsAt: true } }, _count: { select: { products: true } } } },
      _count: { select: { orders: true, buyerConversations: true, reviews: true } },
    },
  }));
  if (!user) redirect("/login");

  const isSeller = dashboardAudience(user.role) === "seller";
  const paths = dashboardPaths(locale);
  const [notificationCount, unreadMessages] = await dashboardData(Promise.all([
    prisma.notification.count({ where: { userId: session.userId, readAt: null } }),
    prisma.message.count({ where: { readAt: null, senderId: { not: session.userId }, conversation: isSeller ? { sellerId: session.userId } : { buyerId: session.userId } } }),
  ]));
  const homeHref = paths.home;
  const buyerOrdersHref = paths.orders;
  const buyerNav: DashboardNavItem[] = [
    { label: p("nav.dashboard"), href: paths.dashboard, icon: Home, active: true },
    { label: p("nav.orders"), href: buyerOrdersHref, icon: ReceiptText },
    { label: p("nav.messages"), href: paths.messages, icon: MessageCircle, badge: unreadMessages },
    { label: common("account"), href: `/${locale}/account`, icon: Settings },
    { label: common("cart"), href: paths.cart, icon: ShoppingCart },
    { label: privacy("privacyData"), href: `/${locale}/info/privacy-data`, icon: ShieldCheck },
  ];
  const sellerCanAddProduct = Boolean(user.store && canPublish(user.store));
  const sellerNav = sellerDashboardNavItems({ locale, storeSlug: user.store?.slug, labels: { dashboard:p("nav.dashboard"), products:p("nav.products"), addProduct:p("nav.addProduct"), orders:p("nav.orders"), messages:p("nav.messages"), statistics:p("nav.statistics"), revenue:p("nav.revenue"), reviews:p("nav.reviews"), store:p("nav.store"), settings:p("nav.settings"), notifications:p("notifications"), eyebrow:p("seller.eyebrow"), logout:common("logout"), menu:s("menu"), collapse:s("collapse") }, accountLabel: common("account"), privacyLabel: privacy("privacyData"), active: "dashboard", unreadMessages });
  const sellerMobileNav = sellerNav;

  if (!isSeller) {
    const orders = await dashboardData(listBuyerOrders(prisma, session.userId));
    const pending = orders.filter((order) => ["PENDING", "PAID", "PROCESSING", "SHIPPED"].includes(order.status)).length;
    const delivered = orders.filter((order) => order.status === "DELIVERED").length;
    const spentByCurrency = orders.filter((order) => buyerPaymentState(order) === "paid").reduce<Record<string, number>>((totals, order) => { totals[order.currency] = (totals[order.currency] ?? 0) + Number(order.total); return totals; }, {});
    const spent = Object.entries(spentByCurrency).map(([currency, total]) => money(locale, total, currency)).join(" · ") || money(locale, 0, "EUR");
    return <main className="premiumDashboard premiumBuyerDashboard">
      <DashboardSidebar items={buyerNav} homeHref={homeHref} logoutLabel={common("logout")} menuLabel={s("menu")} collapseLabel={s("collapse")}/>
      <div className="premiumDashboardMain">
        <DashboardHeader firstName={user.firstName} lastName={user.lastName} eyebrow={p("buyer.eyebrow")} homeHref={homeHref} notificationHref={`/${locale}/notifications`} notificationLabel={p("notifications")} notificationCount={notificationCount}/>
        <div className="premiumDashboardContent">
          <section className="premiumWelcomeHero"><div><span>{p("buyer.badge")}</span><h1>{p("welcome", { name: user.firstName })}</h1><p>{p("buyer.intro")}</p></div><Link href={homeHref}>{p("browseMarketplace")} <ShoppingBag size={18}/></Link></section>
          {orders.length > 0 && <section className="premiumStatsGrid" aria-label={p("recentOrders")}>
            <DashboardStatCard label={p("stats.totalOrders")} value={orders.length} href={buyerOrdersHref} icon={ReceiptText}/>
            <DashboardStatCard label={p("stats.pendingOrders")} value={pending} href={buyerOrdersHref} icon={Package} tone="amber"/>
            <DashboardStatCard label={p("stats.deliveredOrders")} value={delivered} href={buyerOrdersHref} icon={Truck} tone="blue"/>
            <DashboardStatCard label={p("stats.totalSpent")} value={spent} icon={CreditCard} tone="mint"/>
          </section>}
          <div className="premiumDashboardColumns">
            <DashboardSection id="recent-orders" title={p("recentOrders")} description={p("buyer.recentDescription")} action={<Link className="premiumTextLink" href={buyerOrdersHref}>{p("viewAll")}</Link>}>
              {orders.length
                ? <div className="premiumRecentOrders">{orders.slice(0, 4).map((order) => { const step = fulfillmentStepFor(order.status); return <RecentOrder key={order.id} order={order} locale={locale} detailsLabel={ordersText("details")} unknownStore={ordersText("unknownStore")} statusLabel={step ? ordersText(`fulfillment.${step.toLowerCase()}`) : ordersText(`status.${order.status}`)}/>; })}</div>
                : <DashboardEmptyState title={p("buyer.emptyOrders")} description={p("buyer.emptyOrdersText")} action={<Link className="premiumPrimaryButton" href={homeHref}>{p("browseProducts")}</Link>}/>
              }
            </DashboardSection>
            <DashboardSection title={p("quickActions")}><div className="premiumQuickGrid"><DashboardQuickAction label={auth("becomeSeller")} href={`/${locale}/seller/onboarding`} icon={Store} primary/><DashboardQuickAction label={common("account")} href={`/${locale}/account`} icon={Settings}/><DashboardQuickAction label={p("myOrders")} href={buyerOrdersHref} icon={ReceiptText}/><DashboardQuickAction label={p("myMessages")} href={paths.messages} icon={MessageCircle}/></div></DashboardSection>
          </div>
          <section className="premiumDiscoveryBanner"><div><span>{p("discoverBadge")}</span><h2>{p("discoverTitle")}</h2><p>{p("discoverText")}</p></div><Link href={homeHref}>{p("exploreNow")}</Link></section>
        </div>
      </div>
    </main>;
  }

  if (!user.store) return <main className="premiumDashboard premiumSellerDashboard"><DashboardSidebar items={sellerNav} mobileMenuItems={sellerMobileNav} homeHref={homeHref} logoutLabel={common("logout")} menuLabel={s("menu")} collapseLabel={s("collapse")} seller/><div className="premiumDashboardMain"><DashboardHeader firstName={user.firstName} lastName={user.lastName} eyebrow={p("seller.eyebrow")} homeHref={homeHref} notificationHref={paths.dashboard} notificationLabel={p("notifications")} notificationCount={notificationCount}/><div className="premiumDashboardContent"><DashboardEmptyState headingLevel="h1" title={t("openShop")} description={t("openShopText")} action={<Link className="premiumPrimaryButton" href={`/${locale}/seller/create-store`}>{t("createShop")}</Link>}/><StripeConnectSection initialStatus={{ connected: Boolean(user.stripeAccountId), onboardingComplete: user.stripeOnboardingComplete, chargesEnabled: user.stripeChargesEnabled, payoutsEnabled: user.stripePayoutsEnabled }}/></div></div></main>;

  const sellerOrdersWhere = sellerOrderHistoryWhere(session.userId, user.store.id, "");
  const now = new Date();
  const productCurrentStart = new Date(now); productCurrentStart.setDate(productCurrentStart.getDate() - 30);
  const productPreviousStart = new Date(now); productPreviousStart.setDate(productPreviousStart.getDate() - 60);
  const [analyticsOrders, sellerOrders, pendingRefundCount, currentProducts, previousProducts, reviewStats] = await dashboardData(Promise.all([
    prisma.order.findMany({ where: sellerOrdersWhere, select: { status: true, buyerId: true, createdAt: true, paidAt: true, stripePaymentIntentId: true, sellerAmount: true, items: { select: { quantity: true, productNameSnapshot: true, product: { select: { id: true, name: true } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.order.findMany({ where: sellerOrdersWhere, take: 5, select: { id: true, status: true, total: true, currency: true, createdAt: true, paidAt: true, stripePaymentIntentId: true, recipientName: true, buyerNameSnapshot: true, buyer: { select: { firstName: true, lastName: true } }, items: { take: 1, orderBy: { createdAt: "asc" }, select: { productNameSnapshot: true, productImageUrlSnapshot: true, product: { select: { name: true, images: true } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.refundRequest.count({ where: { status: "PENDING", order: sellerOrdersWhere } }),
    prisma.product.count({ where: { storeId: user.store.id, createdAt: { gte: productCurrentStart } } }),
    prisma.product.count({ where: { storeId: user.store.id, createdAt: { gte: productPreviousStart, lt: productCurrentStart } } }),
    prisma.review.aggregate({ where: { product: { storeId: user.store.id }, status: "PUBLISHED" }, _avg: { rating: true }, _count: { rating: true } }),
  ]));
  const paidSellerOrders = analyticsOrders.filter((order) => order.paidAt || order.stripePaymentIntentId);
  const revenue = paidSellerOrders.reduce((sum, order) => sum + (order.sellerAmount ?? 0) / 100, 0);
  const customers = new Set(paidSellerOrders.map((order) => order.buyerId)).size;
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const todayRevenue = paidSellerOrders.filter((order) => (order.paidAt ?? order.createdAt) >= startToday).reduce((sum, order) => sum + (order.sellerAmount ?? 0) / 100, 0);
  const pendingOrders = analyticsOrders.filter((order) => ["PENDING", "PAID", "PROCESSING"].includes(order.status)).length;
  const firstOrderByBuyer = new Map<string, Date>();
  for (const order of analyticsOrders) { const first = firstOrderByBuyer.get(order.buyerId); if (!first || order.createdAt < first) firstOrderByBuyer.set(order.buyerId, order.createdAt); }
  const newCustomers = [...firstOrderByBuyer.values()].filter((date) => date >= startToday).length;
  const profileFields = [user.store.name, user.store.description, user.store.logo, user.store.banner, user.store.city, user.store.country];
  const profileCompletion = Math.round(profileFields.filter(Boolean).length / profileFields.length * 100);
  const periods = sellerPeriodMetrics(analyticsOrders, now);
  const comparison = (current: number, previous: number) => { const percent = comparisonPercent(current, previous); return percent == null ? s("noComparison") : s("comparison", { value: percent > 0 ? `+${percent}` : String(percent) }); };
  const analytics = sellerAnalytics(analyticsOrders, locale, now);
  const analyticsStatuses = analytics.statuses.map((item) => ({ label: ordersText(`status.${item.status}`), value: item.value }));
  const cancellationRate = analyticsOrders.length ? analyticsOrders.filter((order) => order.status === "CANCELLED").length / analyticsOrders.length * 100 : null;
  const subscriptionActive = sellerCanAddProduct;
  const sellerTypeRequired = user.store.sellerType === "UNKNOWN";
  const vatStatusRequired = user.store.sellerType === "PROFESSIONAL" && user.store.vatStatus === "UNKNOWN";
  const readinessHref = sellerTypeRequired || vatStatusRequired ? `/${locale}/seller/store-settings#seller-status` : `/${locale}/seller/subscription`;
  const readinessTitle = sellerTypeRequired ? transparency("statusPending") : vatStatusRequired ? compliance("vatStatus") : control("subscriptionInactive");
  const readinessHelp = sellerTypeRequired ? transparency("typeHelp") : vatStatusRequired ? compliance("vatNoExternalValidation") : control("subscriptionInactiveHelp", { status: control("subscriptionInactive") });
  const readinessAction = sellerTypeRequired ? transparency("typeTitle") : vatStatusRequired ? compliance("vatStatus") : control("viewPlans");
  return <main className="premiumDashboard premiumSellerDashboard">
    <DashboardSidebar items={sellerNav} mobileMenuItems={sellerMobileNav} homeHref={homeHref} logoutLabel={common("logout")} menuLabel={s("menu")} collapseLabel={s("collapse")} seller/>
    <div className="premiumDashboardMain"><DashboardHeader firstName={user.firstName} lastName={user.lastName} eyebrow={p("seller.eyebrow")} homeHref={homeHref} notificationHref={`/${locale}/notifications`} notificationLabel={p("notifications")} notificationCount={notificationCount}/><div className="premiumDashboardContent">
      {!subscriptionActive && <section className="subscriptionWarning" role="status"><strong>{readinessTitle}</strong><span>{readinessHelp}</span><Link href={readinessHref}>{readinessAction}</Link></section>}
      {pendingRefundCount > 0 && <section className="subscriptionWarning" role="alert"><strong>{s(pendingRefundCount === 1 ? "pendingRefundRequestSingular" : "pendingRefundRequestPlural", { count: pendingRefundCount })}</strong><Link href={`/${locale}/seller/orders`}>{s("reviewRefundRequests")}</Link></section>}
      <section className="sellerOverviewHero"><div className="sellerOverviewIntro"><span>{p("seller.badge")}</span><h1>{p("welcome", { name: user.firstName })}</h1><p>{t("shop", { name: user.store.name, city: user.store.city, country: user.store.country })}</p>{profileCompletion < 100 && <div className="storeProfileProgress"><div><span>{s("profileCompletion")}</span><strong>{profileCompletion}%</strong></div><progress max="100" value={profileCompletion}>{profileCompletion}%</progress></div>}</div><div className="sellerHeroMetrics"><div><small>{s("todayRevenue")}</small><strong>{money(locale, todayRevenue, user.store.currency)}</strong></div><div><small>{s("pendingOrders")}</small><strong>{pendingOrders}</strong></div><div><small>{s("newCustomers")}</small><strong>{newCustomers}</strong></div><div><small>{s("unreadMessages")}</small><strong>{unreadMessages}</strong></div></div><Link href={`/${locale}/store/${user.store.slug}`}>{t("viewShop")} <Store size={18}/></Link></section>
      <section className="premiumStatsGrid"><DashboardStatCard label={p("nav.products")} value={user.store._count.products} hint={comparison(currentProducts, previousProducts)} href={`/${locale}/seller/products`} icon={Boxes}/><DashboardStatCard label={p("stats.orders")} value={analyticsOrders.length} hint={comparison(periods.current.orders, periods.previous.orders)} href={`/${locale}/seller/orders`} icon={ReceiptText} tone="blue"/><DashboardStatCard label={p("nav.revenue")} value={money(locale, revenue, user.store.currency)} hint={comparison(periods.current.revenue, periods.previous.revenue)} href={`/${locale}/dashboard#analytics`} icon={TrendingUp} tone="mint"/><DashboardStatCard label={p("stats.customers")} value={customers} hint={comparison(periods.current.customers, periods.previous.customers)} icon={Users} tone="amber"/></section>
      <div className="premiumDashboardColumns sellerColumns"><DashboardSection id="recent-orders" title={p("recentOrders")} description={p("seller.recentDescription")}>
        {analyticsOrders.length
          ? <div className="premiumRecentOrders">{sellerOrders.slice(0, 5).map((order) => { const item = order.items[0]; const image = item?.productImageUrlSnapshot ?? item?.product.images[0]; const name = item?.productNameSnapshot ?? item?.product.name; const buyerName = order.recipientName ?? order.buyerNameSnapshot ?? `${order.buyer.firstName} ${order.buyer.lastName}`; const action = sellerFulfillmentActionFor(order.status); const step = fulfillmentStepFor(order.status); return <article className="premiumRecentOrder sellerRecentOrder" key={order.id}><div className="premiumRecentImage">{image ? <Image src={image} alt="" width={68} height={68} unoptimized/> : <Package size={26} aria-hidden="true"/>}</div><div className="premiumRecentProduct"><strong>{name ?? ordersText("details")}</strong><span>{buyerName} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(order.createdAt)}</span></div><div className="sellerOrderStatuses"><DashboardStatusBadge label={buyerPaymentState(order) === "paid" ? ordersText("payment.paid") : ordersText(`payment.${buyerPaymentState(order)}`)} status={buyerPaymentState(order)}/><DashboardStatusBadge label={step ? ordersText(`fulfillment.${step.toLowerCase()}`) : ordersText(`status.${order.status}`)} status={order.status}/>{action && <SellerFulfillmentControl orderId={order.id} action={action}/>}</div><strong className="premiumRecentTotal">{money(locale, Number(order.total), order.currency)}</strong></article>; })}</div>
          : <DashboardEmptyState title={p("seller.emptyOrders")} description={p("seller.emptyOrdersText")} action={<Link className="premiumPrimaryButton" href={`/${locale}/seller/products`}>{t("manageProducts")}</Link>}/>
        }
      </DashboardSection><DashboardSection title={p("quickActions")}><div className="premiumQuickGrid">{subscriptionActive ? <DashboardQuickAction label={t("addProduct")} href={`/${locale}/seller/products/new`} icon={Plus} primary/> : <DashboardQuickAction label={readinessAction} href={readinessHref} icon={sellerTypeRequired || vatStatusRequired ? Settings : CreditCard} primary/>}<DashboardQuickAction label={p("viewOrders")} href={`/${locale}/seller/orders`} icon={ReceiptText}/><DashboardQuickAction label={t("manageProducts")} href={`/${locale}/seller/products`} icon={Boxes}/><DashboardQuickAction label={p("myMessages")} href={paths.messages} icon={MessageCircle}/><DashboardQuickAction label={p("nav.settings")} href={`/${locale}/seller/store-settings`} icon={Settings}/><DashboardQuickAction label={t("viewShop")} href={`/${locale}/store/${user.store.slug}`} icon={Store}/></div></DashboardSection></div>
      <DashboardSection id="analytics" title={s("analyticsTitle")} description={s("analyticsDescription")}>
        {sellerOrders.length
          ? <SellerAnalytics trends={analytics.trends} products={analytics.products} statuses={analyticsStatuses} currency={user.store.currency} labels={{ revenue: s("revenue30"), orders: s("orders30"), topProducts: s("topProducts"), statuses: s("statusDistribution") }}/>
          : <DashboardEmptyState title={p("noRevenue")} description={p("noRevenueText")} action={<Link className="premiumPrimaryButton" href={`/${locale}/seller/orders`}>{p("viewOrders")}</Link>}/>
        }
      </DashboardSection>
      <DashboardSection id="performance" title={s("performanceTitle")} description={s("performanceDescription")}><div className="sellerPerformanceGrid">{reviewStats._count.rating > 0 && <article><Star size={20}/><span>{s("sellerRating")}</span><strong>{reviewStats._avg.rating?.toFixed(1)} / 5</strong></article>}{cancellationRate != null && <article><ReceiptText size={20}/><span>{s("cancellationRate")}</span><strong>{cancellationRate.toFixed(1)}%</strong></article>}{reviewStats._count.rating === 0 && cancellationRate == null && <DashboardEmptyState title={s("notEnoughData")} description={s("performanceEmpty")}/>}</div></DashboardSection>
      <StripeConnectSection initialStatus={{ connected: Boolean(user.stripeAccountId), onboardingComplete: user.stripeOnboardingComplete, chargesEnabled: user.stripeChargesEnabled, payoutsEnabled: user.stripePayoutsEnabled }}/>
    </div></div>
  </main>;
}
