import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-access";
import { connectReadinessCounts, connectReadinessState, maskedStripeAccountId } from "@/lib/connect-readiness";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const stateLabels = { NOT_STARTED: "Connexion Stripe non commencée", ONBOARDING_INCOMPLETE: "Inscription Stripe incomplète", CHARGES_DISABLED: "Paiements non activés", PAYOUTS_DISABLED: "Versements non activés", READY: "Prêt" } as const;

export default async function ConnectReadinessPage() {
  const [locale, session] = await Promise.all([getLocale(), readSession()]);
  if (!session) redirect(`/${locale}/login`);
  try { await requireAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const stores = await prisma.store.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, name: true, status: true, owner: { select: { id: true, firstName: true, lastName: true, email: true, sellerSuspendedAt: true, stripeAccountId: true, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } } } });
  const counts = connectReadinessCounts(stores.map((store) => store.owner));
  const metrics = [["Vendeurs actifs", counts.activeTotal], ["Vendeurs actifs prêts", counts.activeReady], ["Vendeurs actifs à accompagner", counts.activeRequiringRemediation], ["Vendeurs suspendus / historiques", counts.suspendedHistorical], ["Vendeurs avec un compte connecté", counts.withAccount], ["Vendeurs sans compte connecté", counts.withoutAccount]] as const;
  return <main className="adminPage"><section className="adminShell">
    <header className="adminHero"><div><span>Conformité Stripe Connect</span><h1>Suivi de la préparation des vendeurs</h1><p>Vue opérationnelle en lecture seule. Cette page ne crée ni ne remplace de compte connecté et n’en affiche jamais l’identifiant complet.</p></div><Link href="/adm-barewbar-182203">Retour à l’administration</Link></header>
    <section className="adminPanel"><h2>{counts.compliance === "COMPLIANT" ? "CONFORME" : "ACTION REQUISE"}</h2><p>{counts.compliance === "COMPLIANT" ? "Tous les vendeurs actifs disposent actuellement d’un statut Stripe Connect enregistré et prêt." : `${counts.activeRequiringRemediation} vendeur(s) actif(s) doivent terminer ou corriger leur configuration Stripe Connect avant de pouvoir recevoir des paiements.`}</p><div className="adminStats">{metrics.map(([label, value]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}</div><p>Les vendeurs suspendus restent visibles à des fins d’historique et d’audit, sans être comptés dans la conformité active. Leur réactivation rend de nouveau obligatoire la vérification Stripe Connect. Le paiement et le transfert vendeur vérifient chaque compte connecté via la clé de plateforme Todijo et échouent de manière sécurisée si Stripe ne le considère plus prêt.</p></section>
    <section className="adminPanel adminTablePanel"><h2>Suivi des vendeurs</h2><div className="adminTableWrap"><table><thead><tr><th>Vendeur</th><th>Boutique</th><th>Compte Connect</th><th>Inscription</th><th>Paiements</th><th>Versements</th><th>État de conformité</th><th>Action requise</th></tr></thead><tbody>{stores.map((store) => { const state = connectReadinessState(store.owner); const suspended = Boolean(store.owner.sellerSuspendedAt); const sellerName = [store.owner.firstName, store.owner.lastName].filter(Boolean).join(" ") || store.owner.email; return <tr key={store.id}><td>{sellerName}<small>{store.owner.email}</small></td><td>{store.name}<small>{store.status}</small></td><td>{maskedStripeAccountId(store.owner.stripeAccountId)}</td><td>{store.owner.stripeOnboardingComplete ? "Terminée" : "À terminer"}</td><td>{store.owner.stripeChargesEnabled ? "Activés" : "Désactivés"}</td><td>{store.owner.stripePayoutsEnabled ? "Activés" : "Désactivés"}</td><td>{suspended ? "SUSPENDU / HISTORIQUE — HORS CONFORMITÉ ACTIVE" : stateLabels[state]}</td><td>{suspended ? "Conserver l’historique. Stripe Connect redeviendra obligatoire si l’activité du vendeur reprend." : state === "READY" ? "Aucune action" : "Le vendeur doit ouvrir Tableau de bord → Stripe Connect, terminer ou reprendre l’inscription hébergée par Stripe, puis actualiser le statut."}</td></tr>; })}</tbody></table></div>{stores.length === 0 && <p>Aucun vendeur marketplace trouvé.</p>}</section>
  </section></main>;
}
