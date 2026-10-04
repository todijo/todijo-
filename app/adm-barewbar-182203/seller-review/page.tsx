import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { isLocale, rtlLocales } from "@/i18n/config";
import { sellerReviewMessages } from "@/i18n/seller-review";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-access";
import { readManagedCommercialSummary } from "@/lib/admin-managed-plan";
import { adminAccessStatus } from "@/lib/admin-access-status";
import { AdminAccessStatusHeaders, AdminAccessStatusCells } from "@/components/AdminAccessStatus";
import SellerReviewActions from "./SellerReviewActions";

export const dynamic = "force-dynamic";
export default async function SellerReviewPage() {
  const [requestedLocale, t, verification, session] = await Promise.all([getLocale(), getTranslations("Auth"), getTranslations("SellerBusinessVerification"), readSession()]);
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";
  const copy = sellerReviewMessages[locale];
  if (!session) redirect(`/${locale}/login`);
  try { await requireAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const stores = await prisma.store.findMany({ where: { OR: [{ status: "PENDING" }, { onboardingStatus: { not: "NOT_STARTED" } }] }, take: 100, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], select: { id: true, name: true, status: true, businessId: true, country: true, sellerType: true, sellerLegalForm: true, legalBusinessName: true, businessRegistrationId: true, vatStatus: true, vatNumber: true, onboardingStatus: true, onboardingStep: true, business:{select:{siren:true,inseeVerificationState:true,inseeVerifiedAt:true,inseeVerificationSource:true,inseeVerificationReason:true,establishments:{orderBy:{updatedAt:"desc"},take:10,select:{siret:true,verificationState:true,verifiedAt:true,verificationSource:true,verificationReason:true}}}}, establishment:{select:{siret:true,verificationState:true,verifiedAt:true,verificationSource:true,verificationReason:true}}, subscription: { select: { plan: true, billingInterval: true, status: true, currentPeriodEnd: true } }, accessGrants: { select: { source: true, startsAt: true, endsAt: true } }, owner: { select: { firstName: true, lastName: true, email: true, role: true, emailVerified: true, sellerSuspendedAt: true, stripeAccountId: true, stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } } } });
  const now = new Date();
  const summaries = await Promise.all(stores.map(async store => {
    const summary = await readManagedCommercialSummary(prisma, store.id, now);
    return { store, state: adminAccessStatus({ lifecycle: store.status, onboarding: store.onboardingStatus, access: summary.access, resolutionError: summary.error, billingStatus: summary.target?.subscription?.status ?? null, connect: store.owner }) };
  }));
  return <main className="adminPage" dir={rtlLocales.has(locale) ? "rtl" : "ltr"}><section className="adminShell"><header className="adminHero"><div><h1>{t("sellerReview")}</h1><p>{t("sellerReviewIntro")}</p></div><Link href="/adm-barewbar-182203">{copy.backAdmin}</Link></header><section className="adminPanel adminTablePanel"><div className="adminTableWrap"><table><thead><tr><th>{t("seller")}</th><th>{t("shopName")}</th><AdminAccessStatusHeaders locale={locale}/><th>{t("country")}</th><th>{t("sellerOnboarding")}</th><th>{t("legalForm")}</th><th>{t("companyNumber")}</th><th>{t("vatNumber")}</th></tr></thead><tbody>{summaries.map(({ store, state }) => {const establishment=store.establishment??store.business?.establishments.find(item=>item.siret===store.businessRegistrationId)??null;return <tr key={store.id}><td>{store.owner.firstName} {store.owner.lastName}<small>{store.owner.email} · {store.owner.role}</small></td><td>{store.name}<small>{store.status} · {store.sellerType}</small><small>{copy.connect}: {store.owner.stripeAccountId ? "✓" : "—"} · {copy.onboarding}: {store.owner.stripeOnboardingComplete ? "✓" : "—"} · {copy.charges}: {store.owner.stripeChargesEnabled ? "✓" : "—"} · {copy.payouts}: {store.owner.stripePayoutsEnabled ? "✓" : "—"}</small></td><AdminAccessStatusCells state={state} locale={locale}/><td>{store.country}</td><td>{store.onboardingStatus} · {store.onboardingStep}/4<small>{store.onboardingStatus === "NOT_STARTED" || store.onboardingStep < 4 ? copy.incomplete : store.onboardingStatus === "PENDING_REVIEW" ? copy.awaitingReview : "—"}</small></td><td>{store.sellerLegalForm ?? "—"}<small>{store.legalBusinessName ?? "—"}</small></td><td>{store.businessRegistrationId ?? "—"}{store.sellerType==="PROFESSIONAL"&&store.country==="FR"&&<small>{verification("adminState")}: {store.business?.inseeVerificationState??"NOT_STARTED"} · {verification("adminSiren")}: {store.business?.siren??"—"} · {verification("adminSiret")}: {establishment?.siret??"—"}</small>}</td><td>{store.vatStatus}<small>{store.vatNumber ?? "—"}</small><SellerReviewActions storeId={store.id} locale={locale} reviewable={Boolean(store.businessId) && store.status === "PENDING" && ["PENDING_REVIEW", "IN_PROGRESS", "NEEDS_INFORMATION"].includes(store.onboardingStatus)} approvable={store.onboardingStatus === "PENDING_REVIEW"}/></td></tr>})}</tbody></table></div></section></section></main>;
}
