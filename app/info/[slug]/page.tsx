import Link from "next/link";
import { ArrowLeft, Clock3, FileText, Info, ShieldCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";

const pageTitleKeys: Record<string, string> = {
  about: "about", "how-it-works": "howItWorks", mission: "mission", help: "helpCenter",
  "how-to-buy": "howToBuy", "how-to-sell": "howToSell", delivery: "delivery", returns: "returns",
  safety: "safety", "seller-guide": "sellerGuide", contact: "contact", support: "support",
  "report-problem": "reportProblem", terms: "terms", privacy: "privacy", cookies: "cookies",
  "legal-notice": "legalNotice", "marketplace-rules": "rules",
};
const legalPages = ["terms", "privacy", "cookies", "legal-notice", "marketplace-rules"] as const;
const legalTitleKeys: Record<(typeof legalPages)[number], string> = {
  terms: "terms", privacy: "privacy", cookies: "cookies", "legal-notice": "legalNotice", "marketplace-rules": "rules",
};

export default async function MarketplaceInfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const titleKey = pageTitleKeys[slug];
  if (!titleKey) notFound();
  const [locale, t] = await Promise.all([getLocale(), getTranslations("HomeFooter")]);
  const isLegal = legalPages.includes(slug as (typeof legalPages)[number]);
  const Icon = isLegal ? ShieldCheck : Info;

  return <main className={`marketInfoPage scopedPublicPage${isLegal ? " legalInfoPage" : ""}`}>
    <SiteHeader />
    <section className="marketInfoHero">
      <div className="marketInfoIcon"><Icon size={30} aria-hidden="true"/></div>
      <span><Clock3 size={18} aria-hidden="true"/>{t("comingSoon")}</span>
      <h1>{t(titleKey)}</h1>
      <p>{t("comingSoonText")}</p>
    </section>
    <div className="marketInfoLayout">
      <article className="marketInfoContent">
        <FileText size={28} aria-hidden="true"/>
        <h2>{t(titleKey)}</h2>
        <p>{t("comingSoonText")}</p>
        <Link href={`/${locale}`}><ArrowLeft size={18} aria-hidden="true"/>{t("backHome")}</Link>
      </article>
      {isLegal && <aside className="marketInfoLegalNav"><h2>{t("legalTitle")}</h2><nav aria-label={t("legalTitle")}>{legalPages.map((legalSlug) => <Link className={legalSlug === slug ? "isActive" : ""} href={`/${locale}/info/${legalSlug}`} key={legalSlug}>{t(legalTitleKeys[legalSlug])}</Link>)}</nav></aside>}
    </div>
    <MarketplaceFooter />
  </main>;
}
