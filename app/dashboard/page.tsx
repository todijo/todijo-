import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Bell, Boxes, CreditCard, Home, MessageCircle, Package, Plus, ReceiptText, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Star, Store, TrendingUp, Truck, Users } from "lucide-react";
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
import EmailVerificationNotice from "@/components/EmailVerificationNotice";
import { isLocale } from "@/i18n/config";
import { sellerPrincipals, sellerStoreChoices } from "@/lib/seller-business-access";
import SellerStoreSwitcher from "@/components/SellerStoreSwitcher";
import { sellerBusinessCommercialPlan } from "@/lib/seller-business";
import { sellerTeamCopy } from "@/i18n/seller-team";
import type { TeamPermission } from "@prisma/client";
import FreeSellerStartCard from "@/components/FreeSellerStartCard";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
import { canSellerSelfCreateStore, hasLockedSellerMultiStoreTeaser, hasProSellerCapabilities } from "@/lib/seller-commercial-access";
import { sellerMultiStoreTeaserCopy } from "@/i18n/seller-multi-store-teaser";
import LockedMultiStoreTeaser from "@/components/LockedMultiStoreTeaser";
import { hasVerifiedFrenchBusiness } from "@/lib/seller-business-verification-policy";
import { sellerBusinessVerificationMessage } from "@/lib/seller-dashboard-readiness";

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

const sellerStoreSelect={id:true,name:true,slug:true,description:true,logo:true,banner:true,country:true,city:true,businessRegistrationId:true,currency:true,status:true,sellerType:true,vatStatus:true,business:{select:{siren:true,inseeVerificationState:true,inseeVerificationReason:true}},establishment:{select:{siret:true,legalUnitSiren:true,verificationState:true,verificationReason:true}},subscription:{select:{status:true,currentPeriodEnd:true,cancelAtPeriodEnd:true}},accessGrants:{select:{source:true,startsAt:true,endsAt:true}},_count:{select:{products:true}}} as const;

export default async function DashboardPage({searchParams}:{searchParams:Promise<{store?:string}>}) {
  const [t, p, s, common, ordersText, privacy, transparency, compliance, verification, auth, locale, session] = await Promise.all([
    getTranslations("Dashboard"), getTranslations("DashboardPremium"), getTranslations("SellerDashboard"),
    getTranslations("Common"), getTranslations("Orders"),
    getTranslations("Privacy"), getTranslations("SellerTransparency"), getTranslations("Compliance"),getTranslations("SellerBusinessVerification"), getTranslations("Auth"),
    getLocale(), readSession(),
  ]);
  if (!session) redirect("/login");
  const teamCopy=sellerTeamCopy(locale);

  const user = await dashboardData(prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      firstName: true, lastName: true, email: true, emailVerified: true, role: true,
      stripeAccountId: true, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true,
      store: { select: sellerStoreSelect },
      _count: { select: { orders: true, buyerConversations: true, reviews: true } },
    },
  }));
  if (!user) redirect("/login");

  const isSeller = dashboardAudience(user.role) === "seller";
  const requestedStore=(await searchParams).store;
  const [storeChoices,principals]=isSeller?await dashboardData(Promise.all([sellerStoreChoices(prisma,session.userId),sellerPrincipals(prisma,session.userId)])):[[],[]];
  const principal=principals.find(item=>item.owner)??principals[0]??null;
  if(isSeller&&requestedStore&&requestedStore!=="all"&&!storeChoices.some(store=>store.id===requestedStore))redirect(`/${locale}/dashboard`);
  const ownedStoreChoices=principal?.owner?storeChoices.filter(store=>store.businessId===principal.businessId):[];
  const selectedStoreId=isSeller?(requestedStore&&requestedStore!=="all"?requestedStore:ownedStoreChoices.length===1?ownedStoreChoices[0]?.id:!principal?.owner?storeChoices[0]?.id:null):null;
  const activeStore=selectedStoreId?await dashboardData(prisma.store.findUnique({where:{id:selectedStoreId},select:sellerStoreSelect})):user.store;
  const selectedPrincipal=activeStore?principals.find(item=>item.storeIds.includes(activeStore.id))??null:principal;
  const hasSellerPermission=(permission:TeamPermission)=>Boolean(selectedPrincipal&&(selectedPrincipal.owner||selectedPrincipal.permissions.includes(permission)));
  const canViewProducts=hasSellerPermission("PRODUCT_VIEW");
  const canCreateProducts=hasSellerPermission("PRODUCT_CREATE");
  const canViewOrders=hasSellerPermission("ORDER_VIEW");
  const canViewAnalytics=hasSellerPermission("ANALYTICS_VIEW");
  const canViewSales=hasSellerPermission("SALES_VIEW");
  const canViewMessages=hasSellerPermission("MESSAGE_VIEW");
  const canEditStore=hasSellerPermission("STORE_EDIT_SETTINGS");
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
    { label: p("notifications"), href: `/${locale}/notifications`, icon: Bell, badge: notificationCount },
    { label: common("account"), href: `/${locale}/account`, icon: Settings },
    { label: common("cart"), href: paths.cart, icon: ShoppingCart },
    { label: privacy("privacyData"), href: `/${locale}/info/privacy-data`, icon: ShieldCheck },
  ];
  const selectedCommercialPlan=selectedPrincipal?await dashboardData(sellerBusinessCommercialPlan(prisma,selectedPrincipal.businessId)):null;
  const sellerBenefitCatalogEnabled=Boolean(selectedPrincipal?.owner&&user.role==="SELLER"&&hasProSellerCapabilities(selectedCommercialPlan)&&(await dashboardData(prisma.sellerBenefitAccess.findUnique({where:{businessId:selectedPrincipal.businessId},select:{enabled:true}})))?.enabled);
  const freeCopy = sellerFreeModelCopy(locale);
  const sellerCanAddProduct = Boolean(activeStore && canCreateProducts && canPublish(activeStore,new Date(),selectedCommercialPlan));
  const sellerNav = sellerDashboardNavItems({ locale, storeSlug: activeStore?.slug, publicStoreAvailable:sellerCanAddProduct, proImportAvailable:Boolean(selectedPrincipal?.owner&&hasProSellerCapabilities(selectedCommercialPlan)), ownerTools:Boolean(selectedPrincipal?.owner),permissions:selectedPrincipal?.owner?undefined:selectedPrincipal?.permissions??[],labels: { dashboard:p("nav.dashboard"), products:p("nav.products"), addProduct:p("nav.addProduct"), orders:p("nav.orders"), messages:p("nav.messages"), statistics:p("nav.statistics"), revenue:p("nav.revenue"), reviews:p("nav.reviews"), store:p("nav.store"), settings:p("nav.settings"), notifications:p("notifications"), eyebrow:p("seller.eyebrow"), logout:common("logout"), menu:s("menu"), collapse:s("collapse"), importProducts:freeCopy.importProducts }, accountLabel: common("account"), privacyLabel: privacy("privacyData"), active: "dashboard", unreadMessages });
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
          {!user.emailVerified&&<EmailVerificationNotice email={user.email} locale={isLocale(locale)?locale:"en"}/>}
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

  if(principal?.owner&&ownedStoreChoices.length>1&&!selectedStoreId){
    const ids=ownedStoreChoices.map(store=>store.id);
    const [productCount,groups,orderCount,business,commercialPlan]=await dashboardData(Promise.all([
      prisma.product.count({where:{storeId:{in:ids}}}),
      prisma.orderGroup.findMany({where:{storeId:{in:ids},kind:"MARKETPLACE"},select:{sellerNetAmountMinor:true,order:{select:{currency:true}}}}),
      prisma.order.count({where:{groups:{some:{storeId:{in:ids}}}}}),
      prisma.sellerBusiness.findUnique({where:{id:principal.businessId},select:{id:true}}),
      sellerBusinessCommercialPlan(prisma,principal.businessId),
    ]));
    const revenueByCurrency=groups.reduce<Record<string,number>>((totals,group)=>{totals[group.order.currency]=(totals[group.order.currency]??0)+group.sellerNetAmountMinor;return totals},{});
    const revenue=Object.entries(revenueByCurrency).map(([currency,minor])=>money(locale,minor/100,currency)).join(" · ")||money(locale,0,"EUR");
    const canCreateStore=Boolean(business&&canSellerSelfCreateStore(commercialPlan,ownedStoreChoices.length));
    const teaserCopy=user.role==="SELLER"&&hasLockedSellerMultiStoreTeaser(commercialPlan)?sellerMultiStoreTeaserCopy(locale):null;
    return <main className="premiumDashboard premiumSellerDashboard">
      <DashboardSidebar items={sellerNav} mobileMenuItems={sellerMobileNav} homeHref={homeHref} logoutLabel={common("logout")} menuLabel={s("menu")} collapseLabel={s("collapse")} seller/>
      <div className="premiumDashboardMain">
        <DashboardHeader firstName={user.firstName} lastName={user.lastName} eyebrow={p("seller.eyebrow")} homeHref={homeHref} notificationHref={`/${locale}/notifications`} notificationLabel={p("notifications")} notificationCount={notificationCount}/>
        <div className="premiumDashboardContent">
          <SellerStoreSwitcher stores={storeChoices} allStoresLabel={teamCopy.allStores} storeLabel={p("nav.store")} allowAll/>
          <section className="sellerOverviewHero">
            <div className="sellerOverviewIntro"><span>{p("seller.badge")}</span><h1>{p("welcome",{name:user.firstName})}</h1><p>{teamCopy.allStores}</p></div>
            {canCreateStore&&<Link className="premiumPrimaryButton" href={`/${locale}/seller/stores/new`}>{teamCopy.createStore}</Link>}
          </section>
          <section className="premiumStatsGrid">
            <DashboardStatCard label={p("nav.store")} value={ownedStoreChoices.length} icon={Store}/>
            <DashboardStatCard label={p("nav.products")} value={productCount} icon={Boxes}/>
            <DashboardStatCard label={p("stats.orders")} value={orderCount} icon={ReceiptText} tone="blue"/>
            <DashboardStatCard label={p("nav.revenue")} value={revenue} icon={TrendingUp} tone="mint"/>
          </section>
          <DashboardSection title={p("nav.store")} description={teamCopy.selectStoreHelp}><div className="premiumQuickGrid">{ownedStoreChoices.map(store=><DashboardQuickAction key={store.id} label={store.name} href={`/${locale}/dashboard?store=${store.id}`} icon={Store}/>)}</div></DashboardSection>
          {teaserCopy&&<LockedMultiStoreTeaser copy={teaserCopy}/>}
        </div>
      </div>
    </main>
  }

  if (!activeStore) return <main className="premiumDashboard premiumSellerDashboard"><DashboardSidebar items={sellerNav} mobileMenuItems={sellerMobileNav} homeHref={homeHref} logoutLabel={common("logout")} menuLabel={s("menu")} collapseLabel={s("collapse")} seller/><div className="premiumDashboardMain"><DashboardHeader firstName={user.firstName} lastName={user.lastName} eyebrow={p("seller.eyebrow")} homeHref={homeHref} notificationHref={paths.dashboard} notificationLabel={p("notifications")} notificationCount={notificationCount}/><div className="premiumDashboardContent">{!user.emailVerified&&<EmailVerificationNotice email={user.email} locale={isLocale(locale)?locale:"en"}/>}<FreeSellerStartCard locale={locale} noStore/><DashboardEmptyState headingLevel="h1" title={t("openShop")} description={t("openShopText")} action={<Link className="premiumPrimaryButton" href={`/${locale}/seller/onboarding`}>{t("createShop")}</Link>}/>{principal?.owner&&<StripeConnectSection initialStatus={{ connected: Boolean(user.stripeAccountId), onboardingComplete: user.stripeOnboardingComplete, chargesEnabled: user.stripeChargesEnabled, payoutsEnabled: user.stripePayoutsEnabled }}/>}</div></div></main>;

  const sellerOrdersWhere = sellerOrderHistoryWhere(session.userId, activeStore.id, "");
  const now = new Date();
  const productCurrentStart = new Date(now); productCurrentStart.setDate(productCurrentStart.getDate() - 30);
  const productPreviousStart = new Date(now); productPreviousStart.setDate(productPreviousStart.getDate() - 60);
  const [analyticsOrders, sellerOrders, pendingRefundCount, currentProducts, previousProducts, reviewStats] = await dashboardData(Promise.all([
    canViewAnalytics||canViewSales ? prisma.order.findMany({ where: sellerOrdersWhere, select: { status: true, buyerId: true, createdAt: true, paidAt: true, stripePaymentIntentId: true, sellerAmount: true, items: { select: { quantity: true, productNameSnapshot: true, product: { select: { id: true, name: true } } } } }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    canViewOrders ? prisma.order.findMany({ where: sellerOrdersWhere, take: 5, select: { id: true, status: true, total: true, currency: true, createdAt: true, paidAt: true, stripePaymentIntentId: true, recipientName: true, buyerNameSnapshot: true, buyer: { select: { firstName: true, lastName: true } }, items: { take: 1, orderBy: { createdAt: "asc" }, select: { productNameSnapshot: true, productImageUrlSnapshot: true, product: { select: { name: true, images: true } } } } }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    canViewOrders ? prisma.refundRequest.count({ where: { status: "PENDING", order: sellerOrdersWhere } }) : Promise.resolve(0),
    canViewProducts ? prisma.product.count({ where: { storeId: activeStore.id, createdAt: { gte: productCurrentStart } } }) : Promise.resolve(0),
    canViewProducts ? prisma.product.count({ where: { storeId: activeStore.id, createdAt: { gte: productPreviousStart, lt: productCurrentStart } } }) : Promise.resolve(0),
    canViewAnalytics ? prisma.review.aggregate({ where: { product: { storeId: activeStore.id }, status: "PUBLISHED" }, _avg: { rating: true }, _count: { rating: true } }) : Promise.resolve({_avg:{rating:null},_count:{rating:0}}),
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
  const profileFields = [activeStore.name, activeStore.description, activeStore.logo, activeStore.banner, activeStore.city, activeStore.country];
  const profileCompletion = Math.round(profileFields.filter(Boolean).length / profileFields.length * 100);
  const periods = sellerPeriodMetrics(analyticsOrders, now);
  const comparison = (current: number, previous: number) => { const percent = comparisonPercent(current, previous); return percent == null ? s("noComparison") : s("comparison", { value: percent > 0 ? `+${percent}` : String(percent) }); };
  const analytics = sellerAnalytics(analyticsOrders, locale, now);
  const analyticsStatuses = analytics.statuses.map((item) => ({ label: ordersText(`status.${item.status}`), value: item.value }));
  const cancellationRate = analyticsOrders.length ? analyticsOrders.filter((order) => order.status === "CANCELLED").length / analyticsOrders.length * 100 : null;
  const subscriptionActive = canPublish(activeStore,new Date(),selectedCommercialPlan);
  const sellerTypeRequired = activeStore.sellerType === "UNKNOWN";
  const vatStatusRequired = activeStore.sellerType === "PROFESSIONAL" && activeStore.vatStatus === "UNKNOWN";
  const businessVerificationRequired=!hasVerifiedFrenchBusiness(activeStore);
  const storeReadinessPending=activeStore.status!=="ACTIVE";
  const readinessHref = businessVerificationRequired||sellerTypeRequired || vatStatusRequired || storeReadinessPending ? `/${locale}/seller/store-settings?store=${activeStore.id}#location` : `/${locale}/seller/subscription`;
  const readinessTitle = businessVerificationRequired ? verification("sectionTitle") : sellerTypeRequired ? transparency("statusPending") : vatStatusRequired ? compliance("vatStatus") : activeStore.status==="PENDING" ? freeCopy.storeReviewTitle : storeReadinessPending ? freeCopy.storeUnavailableTitle : freeCopy.readinessTitle;
  const readinessHelp = businessVerificationRequired ? verification(sellerBusinessVerificationMessage({businessState:activeStore.business?.inseeVerificationState,businessReason:activeStore.business?.inseeVerificationReason,establishmentState:activeStore.establishment?.verificationState,establishmentReason:activeStore.establishment?.verificationReason})) : sellerTypeRequired ? transparency("typeHelp") : vatStatusRequired ? compliance("vatNoExternalValidation") : activeStore.status==="PENDING" ? freeCopy.storeReviewHelp : storeReadinessPending ? freeCopy.storeUnavailableHelp : freeCopy.readinessHelp;
  const readinessAction = businessVerificationRequired ? verification("verify") : sellerTypeRequired ? transparency("typeTitle") : vatStatusRequired ? compliance("vatStatus") : selectedCommercialPlan==null ? freeCopy.compare : freeCopy.readinessAction;
  const showReadinessWarning=Boolean(selectedPrincipal?.owner&&!subscriptionActive&&(storeReadinessPending||sellerTypeRequired||vatStatusRequired||businessVerificationRequired||selectedCommercialPlan==null));
  return <main className="premiumDashboard premiumSellerDashboard">
    <DashboardSidebar items={sellerNav} mobileMenuItems={sellerMobileNav} homeHref={homeHref} logoutLabel={common("logout")} menuLabel={s("menu")} collapseLabel={s("collapse")} seller/>
    <div className="premiumDashboardMain"><DashboardHeader firstName={user.firstName} lastName={user.lastName} eyebrow={p("seller.eyebrow")} homeHref={homeHref} notificationHref={`/${locale}/notifications`} notificationLabel={p("notifications")} notificationCount={notificationCount}/><div className="premiumDashboardContent">{!user.emailVerified&&<EmailVerificationNotice email={user.email} locale={isLocale(locale)?locale:"en"}/>}
      {showReadinessWarning && <section className="subscriptionWarning" role="status"><strong>{readinessTitle}</strong><span>{readinessHelp}</span><Link href={readinessHref}>{readinessAction}</Link></section>}
      {pendingRefundCount > 0 && <section className="subscriptionWarning" role="alert"><strong>{s(pendingRefundCount === 1 ? "pendingRefundRequestSingular" : "pendingRefundRequestPlural", { count: pendingRefundCount })}</strong><Link href={`/${locale}/seller/orders`}>{s("reviewRefundRequests")}</Link></section>}
      <SellerStoreSwitcher stores={storeChoices} selectedId={activeStore.id} allStoresLabel={teamCopy.allStores} storeLabel={p("nav.store")} allowAll={Boolean(principal?.owner&&ownedStoreChoices.length>1)}/>
      <section className="sellerOverviewHero"><div className="sellerOverviewIntro"><span>{p("seller.badge")}</span><h1>{p("welcome", { name: user.firstName })}</h1><p>{t("shop", { name: activeStore.name, city: activeStore.city, country: activeStore.country })}</p>{selectedPrincipal?.owner&&profileCompletion < 100 && <div className="storeProfileProgress"><div><span>{s("profileCompletion")}</span><strong>{profileCompletion}%</strong></div><progress max="100" value={profileCompletion}>{profileCompletion}%</progress></div>}</div>{(canViewSales||canViewOrders||canViewMessages)&&<div className="sellerHeroMetrics">{canViewSales&&<div><small>{s("todayRevenue")}</small><strong>{money(locale, todayRevenue, activeStore.currency)}</strong></div>}{canViewOrders&&<><div><small>{s("pendingOrders")}</small><strong>{pendingOrders}</strong></div><div><small>{s("newCustomers")}</small><strong>{newCustomers}</strong></div></>}{canViewMessages&&<div><small>{s("unreadMessages")}</small><strong>{unreadMessages}</strong></div>}</div>}<Link href={subscriptionActive?`/${locale}/store/${activeStore.slug}`:`/${locale}/seller/store-settings?store=${activeStore.id}`}>{t("viewShop")} <Store size={18}/></Link></section>
      {(canViewProducts||canViewOrders||canViewSales||canViewAnalytics)&&<section className="premiumStatsGrid">{canViewProducts&&<DashboardStatCard label={p("nav.products")} value={activeStore._count.products} hint={comparison(currentProducts, previousProducts)} href={`/${locale}/seller/products?store=${activeStore.id}`} icon={Boxes}/>} {canViewOrders&&<DashboardStatCard label={p("stats.orders")} value={sellerOrders.length} href={`/${locale}/seller/orders?store=${activeStore.id}`} icon={ReceiptText} tone="blue"/>} {canViewSales&&<DashboardStatCard label={p("nav.revenue")} value={money(locale, revenue, activeStore.currency)} hint={comparison(periods.current.revenue, periods.previous.revenue)} href={`/${locale}/dashboard?store=${activeStore.id}#analytics`} icon={TrendingUp} tone="mint"/>} {canViewAnalytics&&<DashboardStatCard label={p("stats.customers")} value={customers} hint={comparison(periods.current.customers, periods.previous.customers)} icon={Users} tone="amber"/>}</section>}
      <div className="premiumDashboardColumns sellerColumns">{canViewOrders&&<DashboardSection id="recent-orders" title={p("recentOrders")} description={p("seller.recentDescription")}>
        {analyticsOrders.length
          ? <div className="premiumRecentOrders">{sellerOrders.slice(0, 5).map((order) => { const item = order.items[0]; const image = item?.productImageUrlSnapshot ?? item?.product.images[0]; const name = item?.productNameSnapshot ?? item?.product.name; const buyerName = order.recipientName ?? order.buyerNameSnapshot ?? `${order.buyer.firstName} ${order.buyer.lastName}`; const action = sellerFulfillmentActionFor(order.status); const step = fulfillmentStepFor(order.status); return <article className="premiumRecentOrder sellerRecentOrder" key={order.id}><div className="premiumRecentImage">{image ? <Image src={image} alt="" width={68} height={68} unoptimized/> : <Package size={26} aria-hidden="true"/>}</div><div className="premiumRecentProduct"><strong>{name ?? ordersText("details")}</strong><span>{buyerName} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(order.createdAt)}</span></div><div className="sellerOrderStatuses"><DashboardStatusBadge label={buyerPaymentState(order) === "paid" ? ordersText("payment.paid") : ordersText(`payment.${buyerPaymentState(order)}`)} status={buyerPaymentState(order)}/><DashboardStatusBadge label={step ? ordersText(`fulfillment.${step.toLowerCase()}`) : ordersText(`status.${order.status}`)} status={order.status}/>{action && <SellerFulfillmentControl orderId={order.id} action={action}/>}</div><strong className="premiumRecentTotal">{money(locale, Number(order.total), order.currency)}</strong></article>; })}</div>
          : <DashboardEmptyState title={p("seller.emptyOrders")} description={p("seller.emptyOrdersText")} action={<Link className="premiumPrimaryButton" href={`/${locale}/seller/products`}>{t("manageProducts")}</Link>}/>
        }
      </DashboardSection>}<DashboardSection title={p("quickActions")}><div className="premiumQuickGrid">{sellerCanAddProduct&&<DashboardQuickAction label={t("addProduct")} href={`/${locale}/seller/products/new?store=${activeStore.id}`} icon={Plus} primary/>}{selectedPrincipal?.owner&&!subscriptionActive&&<DashboardQuickAction label={readinessAction} href={readinessHref} icon={sellerTypeRequired || vatStatusRequired ? Settings : CreditCard} primary/>}{canViewOrders&&<DashboardQuickAction label={p("viewOrders")} href={`/${locale}/seller/orders?store=${activeStore.id}`} icon={ReceiptText}/>} {canViewProducts&&<DashboardQuickAction label={t("manageProducts")} href={`/${locale}/seller/products?store=${activeStore.id}`} icon={Boxes}/>} {canViewMessages&&<DashboardQuickAction label={p("myMessages")} href={paths.messages} icon={MessageCircle}/>} {canEditStore&&<DashboardQuickAction label={p("nav.settings")} href={`/${locale}/seller/store-settings?store=${activeStore.id}`} icon={Settings}/>}<DashboardQuickAction label={t("viewShop")} href={subscriptionActive?`/${locale}/store/${activeStore.slug}`:`/${locale}/seller/store-settings?store=${activeStore.id}`} icon={Store}/></div></DashboardSection></div>
      {canViewAnalytics&&<DashboardSection id="analytics" title={s("analyticsTitle")} description={s("analyticsDescription")}>
        {sellerOrders.length
          ? <SellerAnalytics trends={analytics.trends} products={analytics.products} statuses={analyticsStatuses} currency={activeStore.currency} labels={{ revenue: s("revenue30"), orders: s("orders30"), topProducts: s("topProducts"), statuses: s("statusDistribution") }}/>
          : <DashboardEmptyState title={p("noRevenue")} description={p("noRevenueText")} action={<Link className="premiumPrimaryButton" href={`/${locale}/seller/orders`}>{p("viewOrders")}</Link>}/>
        }
      </DashboardSection>}
      {canViewAnalytics&&<DashboardSection id="performance" title={s("performanceTitle")} description={s("performanceDescription")}><div className="sellerPerformanceGrid">{reviewStats._count.rating > 0 && <article><Star size={20}/><span>{s("sellerRating")}</span><strong>{reviewStats._avg.rating?.toFixed(1)} / 5</strong></article>}{cancellationRate != null && <article><ReceiptText size={20}/><span>{s("cancellationRate")}</span><strong>{cancellationRate.toFixed(1)}%</strong></article>}{reviewStats._count.rating === 0 && cancellationRate == null && <DashboardEmptyState title={s("notEnoughData")} description={s("performanceEmpty")}/>}</div></DashboardSection>}
      {selectedPrincipal?.owner && selectedCommercialPlan === "free" && <FreeSellerStartCard locale={locale}/>}
      {selectedPrincipal?.owner && user.role==="SELLER" && ownedStoreChoices.length>0 && hasLockedSellerMultiStoreTeaser(selectedCommercialPlan) && sellerMultiStoreTeaserCopy(locale) && <LockedMultiStoreTeaser copy={sellerMultiStoreTeaserCopy(locale)!}/>}
      {sellerBenefitCatalogEnabled && <section className="storeSetupCard"><h2>Les cadeaux Todijo pour vous</h2><p>Découvrez les cadeaux et avantages sélectionnés par Todijo pour votre activité. Les disponibilités, quantités et tarifs sont indiqués pour chaque article.</p><Link href={`/${locale}/seller/benefits?store=${activeStore.id}`}>Découvrir mes avantages</Link></section>}
      {selectedPrincipal?.owner&&<StripeConnectSection
        commercialEntitlementActive={selectedCommercialPlan!==null}
        initialStatus={{ connected: Boolean(user.stripeAccountId), onboardingComplete: user.stripeOnboardingComplete, chargesEnabled: user.stripeChargesEnabled, payoutsEnabled: user.stripePayoutsEnabled }}/>
      }
    </div></div>
  </main>;
}
