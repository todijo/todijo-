import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { canonicalActiveSellerPlanId, sellerPlans } from "@/lib/seller-plans";
import SubscriptionPlans from "./SubscriptionPlans";
import ActivatingSubscription from "./ActivatingSubscription";
import { getLocale } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { sellerEntitlementSubscriptionMessages } from "@/i18n/seller-entitlement-subscription";

export const dynamic = "force-dynamic";

export default async function SellerSubscriptionPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const [query, locale] = await Promise.all([searchParams, getLocale()]);
  const session = await readSession();
  if (!session) redirect(`/${locale}/login`);
  const store = await prisma.store.findUnique({ where: { ownerId: session.userId }, select: { name: true, owner: { select: { role: true } }, subscription: true } });
  if (!store) redirect(`/${locale}/seller/create-store`);
  const active = ["ACTIVE", "TRIALING"].includes(store.subscription?.status ?? "");
  if (query.checkout === "success" && active) redirect(`/${locale}/seller/products/new`);
  const copy=sellerEntitlementSubscriptionMessages[isLocale(locale)?locale:"en"];
  const plans = sellerPlans().map(({ priceId, ...plan }) => ({ ...plan, features:[plan.productLimit?copy.upTo(plan.productLimit):copy.unlimited,copy.sellerDashboard,copy.ordersRevenue], available: Boolean(priceId) }));
  const activePlanId = canonicalActiveSellerPlanId(store.subscription);
  return <main className="storeSetupPage"><section className="storeSetupCard subscriptionShell">
    <a className="authBack" href={`/${locale}/dashboard`}>← {copy.dashboard}</a><p className="dashboardBadge">{store.name}</p>
    <h1>{copy.title}</h1><p className="storeSetupIntro">{copy.intro}</p>
    {query.checkout === "success" && !active ? <ActivatingSubscription /> : <>
      {store.subscription && <div className={`subscriptionStatus ${active ? "isActive" : ""}`}>{copy.currentStatus} <strong>{store.subscription.status}</strong>{store.subscription.cancelAtPeriodEnd && ` · ${copy.cancels}`}</div>}
      {store.owner.role==="ADMIN"&&<div className="subscriptionStatus isActive">{copy.adminAccess}</div>}
      <SubscriptionPlans plans={plans} activePlanId={activePlanId} hasActiveSubscription={active} copy={copy}/>
    </>}
  </section></main>;
}
