import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { isLocale, rtlLocales } from "@/i18n/config";
import { sellerReviewMessages, sellerReviewStateLabel } from "@/i18n/seller-review";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-access";
import { readManagedCommercialSummary } from "@/lib/admin-managed-plan";
import { adminAccessStatus, adminStatusDisplay } from "@/lib/admin-access-status";
import { adminAccessLabels } from "@/components/AdminAccessStatus";
import { pendingSellerReviewWhere } from "@/lib/seller-review-alerts";
import SellerReviewActions from "./SellerReviewActions";

export const dynamic = "force-dynamic";
export default async function SellerReviewPage() {
  const [requestedLocale, t, verification, session] = await Promise.all([getLocale(), getTranslations("Auth"), getTranslations("SellerBusinessVerification"), readSession()]);
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";
  const copy = sellerReviewMessages[locale];
  const accessCopy = adminAccessLabels(locale);
  const stateLabel = (group: Parameters<typeof sellerReviewStateLabel>[1], value: string | null | undefined) => sellerReviewStateLabel(locale, group, value);
  const countryLabel = (code: string) => { try { return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code; } catch { return code; } };
  if (!session) redirect("/" + locale + "/login");
  try { await requireAdmin(prisma, session); } catch { redirect("/" + locale + "/dashboard"); }
  const stores = await prisma.store.findMany({ where: { OR: [{ status: "PENDING" }, { onboardingStatus: { not: "NOT_STARTED" } }] }, take: 100, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], select: { id: true, name: true, status: true, businessId: true, country: true, sellerType: true, sellerLegalForm: true, legalBusinessName: true, businessRegistrationId: true, vatStatus: true, vatNumber: true, onboardingStatus: true, onboardingStep: true, business:{select:{siren:true,inseeVerificationState:true,inseeVerifiedAt:true,inseeVerificationSource:true,inseeVerificationReason:true,establishments:{orderBy:{updatedAt:"desc"},take:10,select:{siret:true,verificationState:true,verifiedAt:true,verificationSource:true,verificationReason:true}}}}, establishment:{select:{siret:true,verificationState:true,verifiedAt:true,verificationSource:true,verificationReason:true}}, subscription: { select: { plan: true, billingInterval: true, status: true, currentPeriodEnd: true } }, accessGrants: { select: { source: true, startsAt: true, endsAt: true } }, owner: { select: { firstName: true, lastName: true, email: true, role: true, emailVerified: true, sellerSuspendedAt: true, stripeAccountId: true, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } } } });
  const [pendingCount, summaries] = await Promise.all([
    prisma.store.count({ where: pendingSellerReviewWhere() }),
    Promise.all(stores.map(async store => {
      const summary = await readManagedCommercialSummary(prisma, store.id);
      return { store, state: adminAccessStatus({ lifecycle: store.status, onboarding: store.onboardingStatus, access: summary.access, resolutionError: summary.error, billingStatus: summary.target?.subscription?.status ?? null, connect: store.owner }) };
    })),
  ]);
  const isPending = (store: typeof stores[number]) => store.status === "PENDING" && store.onboardingStatus === "PENDING_REVIEW" && store.onboardingStep >= 4 && Boolean(store.businessId) && store.owner.role === "SELLER" && store.owner.emailVerified;
  return <main className="adminPage" dir={rtlLocales.has(locale) ? "rtl" : "ltr"}><section className="adminShell"><header className="adminHero"><div><h1>{t("sellerReview")}</h1><p>{t("sellerReviewIntro")}</p>{pendingCount > 0 && <strong className="adminSellerReviewSummary">{locale === "fr" ? String(pendingCount) + " vendeur(s) à vérifier" : pendingCount}</strong>}</div><Link href="/adm-barewbar-182203">{copy.backAdmin}</Link></header>
    {pendingCount === 0 && locale === "fr" && <p className="adminSellerReviewEmpty">Aucun vendeur en attente de vérification</p>}
    <section className="adminSellerReviewGrid">{summaries.map(({ store, state }) => {
      const establishment=store.establishment??store.business?.establishments.find(item=>item.siret===store.businessRegistrationId)??null;
      const reviewable=Boolean(store.businessId)&&store.status==="PENDING"&&["PENDING_REVIEW","IN_PROGRESS","NEEDS_INFORMATION"].includes(store.onboardingStatus);
      return <article className="adminSellerReviewCard" key={store.id}>
        <header><div><span className="adminSellerReviewEyebrow">{locale === "fr" && isPending(store) ? "Demande de vérification vendeur" : t("sellerReview")}</span><h2>{store.name}</h2><p>{store.owner.firstName} {store.owner.lastName} · {store.owner.email}</p></div><span className="adminSellerReviewState">{stateLabel("onboarding",store.onboardingStatus)} · {stateLabel("store",store.status)}</span></header>
        <dl className="adminSellerReviewFacts">
          <div><dt>{t("seller")}</dt><dd>{stateLabel("role",store.owner.role)} · {stateLabel("sellerType",store.sellerType)}</dd></div>
          <div><dt>{t("email")}</dt><dd>{store.owner.emailVerified?t("verified"):t("notVerified")}</dd></div>
          <div><dt>{accessCopy.source}</dt><dd>{state.resolutionError?"—":accessCopy[state.source]}</dd></div>
          <div><dt>{accessCopy.active}</dt><dd>{state.active?accessCopy.yes:accessCopy.no}</dd></div>
          <div><dt>{accessCopy.plan}</dt><dd>{state.plan??"—"} · {accessCopy.capability}: {state.capabilityTier??"—"}</dd></div>
          <div><dt>{accessCopy.billing}</dt><dd>{state.source==="ADMIN_EXEMPT"?accessCopy.notRequired:adminStatusDisplay(state.billingStatus,"billing",locale)}</dd></div>
          <div><dt>{copy.connect}</dt><dd>{adminStatusDisplay(state.connectReadiness,"connect",locale)} · {store.owner.stripeAccountId?"✓":"—"}</dd></div>
          <div><dt>{copy.onboarding}</dt><dd>{store.owner.stripeOnboardingComplete?"✓":"—"} · {copy.charges}: {store.owner.stripeChargesEnabled?"✓":"—"} · {copy.payouts}: {store.owner.stripePayoutsEnabled?"✓":"—"}</dd></div>
          <div><dt>{t("country")}</dt><dd>{countryLabel(store.country)}</dd></div>
          <div><dt>{t("sellerOnboarding")}</dt><dd>{stateLabel("onboarding",store.onboardingStatus)} · {store.onboardingStep}/4</dd></div>
          <div><dt>{t("legalForm")}</dt><dd>{stateLabel("legalForm",store.sellerLegalForm)} · {store.legalBusinessName??"—"}</dd></div>
          <div><dt>{t("companyNumber")}</dt><dd>{store.businessRegistrationId??"—"}{store.sellerType==="PROFESSIONAL"&&store.country==="FR"&&<small>{verification("adminState")}: {stateLabel("verification",store.business?.inseeVerificationState)} · {verification("adminSiren")}: {store.business?.siren??"—"} · {verification("adminSiret")}: {establishment?.siret??"—"}</small>}</dd></div>
          <div><dt>{t("vatNumber")}</dt><dd>{stateLabel("vat",store.vatStatus)} · {store.vatNumber??"—"}</dd></div>
        </dl>
        <SellerReviewActions storeId={store.id} locale={locale} reviewable={reviewable} approvable={store.onboardingStatus==="PENDING_REVIEW"}/>
      </article>;
    })}</section></section></main>;
}
