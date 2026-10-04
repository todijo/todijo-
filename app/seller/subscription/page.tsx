import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { canonicalActiveSellerPlanId, sellerPlans, sellerPlanEntitlement } from "@/lib/seller-plans";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "@/lib/seller-registration-intent";
import SubscriptionPlans from "./SubscriptionPlans";
import ActivatingSubscription from "./ActivatingSubscription";
import { getLocale } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { sellerEntitlementSubscriptionMessages } from "@/i18n/seller-entitlement-subscription";
import { sellerPlanSelectionMessages } from "@/i18n/seller-plan-selection";
import { resolveSellerCommercialAccess } from "@/lib/seller-commercial-access";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { requireBusinessOwner } from "@/lib/seller-business-access";
import { sellerOnboardingJourneyCopy } from "@/i18n/seller-onboarding-journey";

export const dynamic = "force-dynamic";

export default async function SellerSubscriptionPage({ searchParams }: { searchParams: Promise<{ checkout?: string; plan?: string; interval?: string }> }) {
  const [query, locale] = await Promise.all([searchParams, getLocale()]);
  const sellerIntent = explicitSellerRegistrationIntent(query.plan, query.interval);
  const session = await readSession();
  if (!session) {
    const next = sellerIntent ? sellerOnboardingPath(locale, true, sellerIntent) : `/${locale}/seller/subscription`;
    redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);
  }
  let principal;
  try { principal = await requireBusinessOwner(prisma, session.userId); }
  catch { redirect(`/${locale}/dashboard`); }
  const business = await prisma.sellerBusiness.findUnique({ where: { id: principal.businessId }, select: { billingStoreId: true } });
  const store = business?.billingStoreId ? await prisma.store.findFirst({ where: { id: business.billingStoreId, ownerId: session.userId }, select: { name: true, slug:true, owner: { select: { role: true, firstName:true, lastName:true,stripeAccountId:true,stripeOnboardingComplete:true,stripeChargesEnabled:true,stripePayoutsEnabled:true } }, subscription: true, accessGrants: { select: { source: true, plan: true, startsAt: true, endsAt: true } } } }) : null;
  if (!store) redirect(sellerIntent ? sellerOnboardingPath(locale, false, sellerIntent) : `/${locale}/sell#plans`);
  const commercial = resolveSellerCommercialAccess({ role: store.owner.role, subscription: store.subscription, accessGrants: store.accessGrants });
  const accessSource = commercial.source;
  const active = accessSource === "STRIPE";
  const hasActiveEntitlement = active || accessSource === "ADMIN_EXEMPT";
  if (query.checkout === "success" && active) {
    const connectReady=Boolean(store.owner.stripeAccountId&&store.owner.stripeOnboardingComplete&&store.owner.stripeChargesEnabled&&store.owner.stripePayoutsEnabled);
    redirect(connectReady?`/${locale}/dashboard`:`/${locale}/seller/payment-setup`);
  }
  const resolvedLocale=isLocale(locale)?locale:"en";
  const copy={...sellerEntitlementSubscriptionMessages[resolvedLocale],...sellerPlanSelectionMessages[resolvedLocale]};
  const journeyCopy=sellerOnboardingJourneyCopy(resolvedLocale);
  const freeCopy = sellerFreeModelCopy(locale);
  const plans = sellerPlans().map(({ priceIds, ...plan }) => ({
    ...plan,
    productLimitLabel:plan.productLimit?copy.upTo(plan.productLimit):copy.unlimited,
    features:[plan.productLimit?copy.upTo(plan.productLimit):copy.unlimited,copy.sellerDashboard,copy.ordersRevenue, ...(plan.id === "pro" ? [freeCopy.proHelp, freeCopy.resurfacing, freeCopy.suppliesHelp] : [freeCopy.oneStore, plan.id === "free" ? freeCopy.freeHelp : freeCopy.plusHelp])],
    available: { monthly: Boolean(priceIds.monthly), annual: Boolean(priceIds.annual) },
  }));
  const clientCopy={monthly:copy.monthly,annual:copy.annual,save20:copy.save20,perMonth:copy.perMonth,perYear:copy.perYear,opening:copy.opening,active:copy.active,anotherActive:copy.anotherActive,subscribe:copy.subscribe,unavailable:copy.unavailable,checkoutError:copy.checkoutError};
  const activePlanId = canonicalActiveSellerPlanId(store.subscription) ?? (commercial.plan === "admin-exempt" ? "pro" : commercial.plan);
  const pendingChange = store.subscription ? await prisma.sellerSubscriptionChange.findFirst({ where: { sellerSubscriptionId: store.subscription.id, status: { in: ["PREPARED", "AWAITING_PAYMENT"] } }, select: { operation: true, targetPlan: true, targetBillingInterval: true, status: true } }) : null;
  const productLimit = sellerPlanEntitlement(activePlanId)?.productLimit;
  const usage = await prisma.store.findMany({ where: { businessId: principal.businessId }, select: { _count: { select: { products: true } } } });
  const overQuota = productLimit != null && usage.some(item => item._count.products > productLimit);
  const transition = { allowed: active && Boolean(store.subscription?.stripeSubscriptionId) && store.subscription?.status === "ACTIVE" && !store.subscription.cancelAtPeriodEnd,
    currentInterval: store.subscription?.billingInterval ?? "monthly", periodEnd: store.subscription?.currentPeriodEnd?.toISOString() ?? null,
    scheduledPlan: store.subscription?.scheduledPlan ?? null, scheduledInterval: store.subscription?.scheduledBillingInterval ?? null,
    scheduledAt: store.subscription?.scheduledChangeAt?.toISOString() ?? null, pending: Boolean(pendingChange), retry: pendingChange?.status === "PREPARED" ? { planId: pendingChange.targetPlan, interval: pendingChange.targetBillingInterval, cancel: pendingChange.operation === "CANCEL_SCHEDULE" } : null, overQuota };
  return <SellerDashboardLayout locale={locale} storeSlug={store.slug} firstName={store.owner.firstName} lastName={store.owner.lastName} active="subscription"><div className="storeSetupPage"><section className="storeSetupCard subscriptionShell">
    <a className="authBack" href={`/${locale}/dashboard`}>← {copy.dashboard}</a><p className="dashboardBadge">{store.name}</p>
    <h1>{copy.title}</h1><p className="storeSetupIntro">{freeCopy.intro}</p>
    {query.checkout === "success" && !active ? <ActivatingSubscription locale={locale}/> : <>
      {store.subscription && <div className={`subscriptionStatus ${active ? "isActive" : ""}`}>{copy.currentStatus} <strong>{store.subscription.status}</strong>{store.subscription.cancelAtPeriodEnd && ` · ${copy.cancels}`}</div>}
      {(store.owner.role==="ADMIN"||accessSource==="ADMIN_GRANTED"||accessSource==="ADMIN_EXEMPT")&&<div className="subscriptionStatus isActive">{copy.adminAccess}</div>}
      {sellerIntent && <><ol className="sellerJourneyProgress"><li className="isComplete">1 · {journeyCopy.account}</li><li className="isComplete">2 · {journeyCopy.information}</li><li className="isCurrent">3 · {journeyCopy.subscription}</li><li>4 · {journeyCopy.paymentSetup}</li><li>5 · {journeyCopy.ready}</li></ol><p className="sellerPaymentReassurance">🔒 {journeyCopy.secureStripe}</p></>}
      <SubscriptionPlans transition={transition} locale={locale} plans={plans} activePlanId={activePlanId} hasActiveSubscription={hasActiveEntitlement} copy={clientCopy} initialPlanId={sellerIntent?.plan ?? null} initialInterval={sellerIntent?.interval ?? "monthly"} productCount={usage.reduce((sum, store) => sum + store._count.products, 0)} checkoutCanceled={query.checkout === "cancel"}/>
    </>}
  </section></div></SellerDashboardLayout>;
}
