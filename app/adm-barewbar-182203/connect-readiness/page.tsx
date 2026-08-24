import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-access";
import { connectReadinessCounts } from "@/lib/connect-readiness";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ConnectReadinessPage() {
  const [locale, session] = await Promise.all([getLocale(), readSession()]);
  if (!session) redirect(`/${locale}/login`);
  try { await requireAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const rows = await prisma.store.findMany({ select: { owner: { select: { stripeAccountId: true, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } } } });
  const counts = connectReadinessCounts(rows.map((row) => row.owner));
  const metrics = [["Total marketplace sellers", counts.total], ["With connected account", counts.withAccount], ["Without connected account", counts.withoutAccount], ["Incomplete onboarding", counts.incompleteOnboarding], ["Charges disabled", counts.chargesDisabled], ["Payouts disabled", counts.payoutsDisabled], ["Ready", counts.ready]] as const;
  return <main className="adminPage"><section className="adminShell"><header className="adminHero"><div><span>Stripe Connect</span><h1>Seller readiness</h1><p>Read-only persisted readiness. Stripe webhooks and authenticated checkout/status checks synchronize these fields; this report never creates or replaces an account.</p></div><Link href="/adm-barewbar-182203">Back to admin</Link></header><section className="adminPanel"><div className="adminStats">{metrics.map(([label, value]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}</div><p>Ready requires an account ID, completed onboarding, charges enabled, and payouts enabled. Checkout and transfers also retrieve the account through the Todijo platform key and fail closed if Stripe no longer reports it ready.</p></section></section></main>;
}
