import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-access";
import { connectReadinessCounts, connectReadinessState, maskedStripeAccountId } from "@/lib/connect-readiness";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const stateLabels = { NOT_STARTED: "Connect not started", ONBOARDING_INCOMPLETE: "Onboarding incomplete", CHARGES_DISABLED: "Charges disabled", PAYOUTS_DISABLED: "Payouts disabled", READY: "Ready" } as const;

export default async function ConnectReadinessPage() {
  const [locale, session] = await Promise.all([getLocale(), readSession()]);
  if (!session) redirect(`/${locale}/login`);
  try { await requireAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const stores = await prisma.store.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, name: true, status: true, owner: { select: { id: true, firstName: true, lastName: true, email: true, sellerSuspendedAt: true, stripeAccountId: true, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } } } });
  const counts = connectReadinessCounts(stores.map((store) => store.owner));
  const metrics = [["Active marketplace sellers", counts.activeTotal], ["Active sellers fully ready", counts.activeReady], ["Active sellers requiring remediation", counts.activeRequiringRemediation], ["Suspended / historical sellers", counts.suspendedHistorical], ["All sellers with connected account", counts.withAccount], ["All sellers without connected account", counts.withoutAccount]] as const;
  return <main className="adminPage"><section className="adminShell">
    <header className="adminHero"><div><span>Stripe Connect compliance</span><h1>Seller readiness register</h1><p>Read-only operational evidence. This view never creates, replaces, or exposes a full connected-account ID.</p></div><Link href="/adm-barewbar-182203">Back to admin</Link></header>
    <section className="adminPanel"><h2>{counts.compliance === "COMPLIANT" ? "COMPLIANT" : "ACTION REQUIRED"}</h2><p>{counts.compliance === "COMPLIANT" ? "Every active marketplace seller currently has persisted Connect readiness." : `${counts.activeRequiringRemediation} active seller(s) must complete or remediate Stripe Connect before marketplace checkout can proceed.`}</p><div className="adminStats">{metrics.map(([label, value]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}</div><p>Suspended sellers remain visible for historical and audit evidence but are not counted in active marketplace compliance. Reactivation immediately makes Connect readiness required again. Checkout and seller-transfer execution retrieve each connected account through the Todijo platform key and fail closed if Stripe no longer reports it ready.</p></section>
    <section className="adminPanel adminTablePanel"><h2>Seller remediation</h2><div className="adminTableWrap"><table><thead><tr><th>Seller</th><th>Store</th><th>Connect account</th><th>Onboarding</th><th>Charges</th><th>Payouts</th><th>Compliance state</th><th>Required action</th></tr></thead><tbody>{stores.map((store) => { const state = connectReadinessState(store.owner); const suspended = Boolean(store.owner.sellerSuspendedAt); const sellerName = [store.owner.firstName, store.owner.lastName].filter(Boolean).join(" ") || store.owner.email; return <tr key={store.id}><td>{sellerName}<small>{store.owner.email}</small></td><td>{store.name}<small>{store.status}</small></td><td>{maskedStripeAccountId(store.owner.stripeAccountId)}</td><td>{store.owner.stripeOnboardingComplete ? "Complete" : "Incomplete"}</td><td>{store.owner.stripeChargesEnabled ? "Enabled" : "Disabled"}</td><td>{store.owner.stripePayoutsEnabled ? "Enabled" : "Disabled"}</td><td>{suspended ? "SUSPENDED / HISTORICAL — NOT COUNTED IN ACTIVE COMPLIANCE" : stateLabels[state]}</td><td>{suspended ? "Preserve history. Connect readiness becomes mandatory if seller activity is restored." : state === "READY" ? "No action" : "Seller must open Dashboard → Connect Stripe and start/resume Stripe-hosted onboarding, then refresh status."}</td></tr>; })}</tbody></table></div>{stores.length === 0 && <p>No marketplace sellers found.</p>}</section>
  </section></main>;
}
