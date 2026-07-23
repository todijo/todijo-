import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { sellerPlans } from "@/lib/seller-plans";
import SubscriptionPlans from "./SubscriptionPlans";
import ActivatingSubscription from "./ActivatingSubscription";

export const dynamic = "force-dynamic";

export default async function SellerSubscriptionPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const query = await searchParams;
  const session = await readSession();
  if (!session) redirect("/login");
  const store = await prisma.store.findUnique({ where: { ownerId: session.userId }, select: { name: true, subscription: true } });
  if (!store) redirect("/seller/create-store");
  const active = ["ACTIVE", "TRIALING"].includes(store.subscription?.status ?? "");
  if (query.checkout === "success" && active) redirect("/seller/products/new");
  const plans = sellerPlans().map(({ priceId, ...plan }) => ({ ...plan, available: Boolean(priceId) }));
  return <main className="storeSetupPage"><section className="storeSetupCard subscriptionShell">
    <a className="authBack" href="/dashboard">← Dashboard</a><p className="dashboardBadge">{store.name}</p>
    <h1>Seller subscription</h1><p className="storeSetupIntro">Choose a monthly plan to publish products. Stripe securely manages billing.</p>
    {query.checkout === "success" && !active ? <ActivatingSubscription /> : <>
      {store.subscription && <div className={`subscriptionStatus ${active ? "isActive" : ""}`}>Current status: <strong>{store.subscription.status}</strong>{store.subscription.cancelAtPeriodEnd && " · Cancels at period end"}</div>}
      <SubscriptionPlans plans={plans} active={active}/>
    </>}
  </section></main>;
}
