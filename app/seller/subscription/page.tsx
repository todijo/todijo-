import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { canonicalActiveSellerPlanId, sellerPlans } from "@/lib/seller-plans";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "@/lib/seller-registration-intent";
import SubscriptionPlans from "./SubscriptionPlans";
import ActivatingSubscription from "./ActivatingSubscription";
import { getLocale } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { sellerEntitlementSubscriptionMessages } from "@/i18n/seller-entitlement-subscription";
import { sellerPlanSelectionMessages } from "@/i18n/seller-plan-selection";
import { activeAccessSource } from "@/lib/admin-access";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";

export const dynamic = "force-dynamic";

export default async function SellerSubscriptionPage({ searchParams }: { searchParams: Promise<{ checkout?: string; plan?: string; interval?: string }> }) {
  const [query, locale] = await Promise.all([searchParams, getLocale()]);
  const sellerIntent = explicitSellerRegistrationIntent(query.plan, query.interval);
  const session = await readSession();
  if (!session) {
    const next = sellerIntent ? sellerOnboardingPath(locale, true, sellerIntent) : `/${locale}/seller/subscription`;
    redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);
  }
  const store = await prisma.store.findUnique({ where: { ownerId: session.userId }, select: { name: true, slug:true, owner: { select: { role: true, firstName:true, lastName:true } }, subscription: true, accessGrants: { select: { source: true, startsAt: true, endsAt: true } } } });
  if (!store) redirect(sellerIntent ? sellerOnboardingPath(locale, false, sellerIntent) : `/${locale}/sell#plans`);
  const active = ["ACTIVE", "TRIALING"].includes(store.subscription?.status ?? "");
  const accessSource = activeAccessSource(store).source;
  const hasActiveEntitlement = accessSource !== "NONE";
  if (query.checkout === "success" && active) redirect(`/${locale}/seller/products/new`);
  const resolvedLocale=isLocale(locale)?locale:"en";
  const copy={...sellerEntitlementSubscriptionMessages[resolvedLocale],...sellerPlanSelectionMessages[resolvedLocale]};
  const plans = sellerPlans().map(({ priceIds, ...plan }) => ({
    ...plan,
    features:[plan.productLimit?copy.upTo(plan.productLimit):copy.unlimited,copy.sellerDashboard,copy.ordersRevenue],
    available: { monthly: Boolean(priceIds.monthly), annual: Boolean(priceIds.annual) },
  }));
  const activePlanId = canonicalActiveSellerPlanId(store.subscription);
  return <SellerDashboardLayout locale={locale} storeSlug={store.slug} firstName={store.owner.firstName} lastName={store.owner.lastName} active="subscription"><div className="storeSetupPage"><section className="storeSetupCard subscriptionShell">
    <a className="authBack" href={`/${locale}/dashboard`}>← {copy.dashboard}</a><p className="dashboardBadge">{store.name}</p>
    <h1>{copy.title}</h1><p className="storeSetupIntro">{copy.intro}</p>
    {query.checkout === "success" && !active ? <ActivatingSubscription /> : <>
      {store.subscription && <div className={`subscriptionStatus ${active ? "isActive" : ""}`}>{copy.currentStatus} <strong>{store.subscription.status}</strong>{store.subscription.cancelAtPeriodEnd && ` · ${copy.cancels}`}</div>}
      {(store.owner.role==="ADMIN"||accessSource==="ADMIN_GRANTED"||accessSource==="ADMIN_EXEMPT")&&<div className="subscriptionStatus isActive">{copy.adminAccess}</div>}
      <SubscriptionPlans plans={plans} activePlanId={activePlanId} hasActiveSubscription={hasActiveEntitlement} copy={copy} initialPlanId={sellerIntent?.plan ?? null} initialInterval={sellerIntent?.interval ?? "monthly"}/>
    </>}
  </section></div></SellerDashboardLayout>;
}
