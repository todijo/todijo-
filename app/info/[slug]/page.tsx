import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import PrivacyInformation from "@/components/PrivacyInformation";
import MarketplaceLegalPolicy from "@/components/MarketplaceLegalPolicy";
import MarketplaceInfoContent from "@/components/MarketplaceInfoContent";
import { privacyPublicProfile } from "@/lib/privacy-legal";
import { concise, localizedAlternates, localizedPath } from "@/lib/seo";
import { type Locale } from "@/i18n/config";

const pageTitleKeys: Record<string, string> = {
  about: "about", "how-it-works": "howItWorks", mission: "mission", help: "helpCenter", "how-to-buy": "howToBuy", "how-to-sell": "howToSell", delivery: "delivery", returns: "returns", safety: "safety", "seller-guide": "sellerGuide", contact: "contact", support: "support", "report-problem": "reportProblem", terms: "terms", privacy: "privacy", cookies: "cookies", "privacy-data": "privacyData", "legal-notice": "legalNotice", "marketplace-rules": "rules", "seller-terms": "terms",
};
const legalPages = ["terms", "seller-terms", "returns", "privacy", "cookies", "legal-notice", "marketplace-rules"] as const;
const legalTitleKeys: Record<(typeof legalPages)[number], string> = { terms: "terms", "seller-terms": "terms", returns: "returns", privacy: "privacy", cookies: "cookies", "legal-notice": "legalNotice", "marketplace-rules": "rules" };
const policyKinds = { terms: "terms", "seller-terms": "seller", returns: "returns" } as const;
const cleanupKinds = { "legal-notice": "legalNotice", "marketplace-rules": "rules" } as const;
const publicInfoSlugs = ["about", "how-it-works", "mission", "help", "how-to-buy", "how-to-sell", "delivery", "safety", "seller-guide", "contact", "support", "report-problem"] as const;
const related: Record<(typeof publicInfoSlugs)[number], string[]> = {
  about: ["how-it-works", "mission"], "how-it-works": ["how-to-buy", "how-to-sell"], mission: ["about", "safety"], help: ["how-to-buy", "how-to-sell", "support", "report-problem"], "how-to-buy": ["safety", "delivery", "returns", "help"], "how-to-sell": ["seller-guide", "seller-terms", "marketplace-rules"], delivery: ["returns", "support"], safety: ["report-problem", "marketplace-rules"], "seller-guide": ["dashboard", "seller-terms", "marketplace-rules", "support"], contact: ["support", "report-problem", "privacy"], support: ["help", "report-problem"], "report-problem": ["safety", "support"],
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [{ slug }, locale, footer, infoPages, metadataText, legal, legalCleanup] = await Promise.all([
    params, getLocale() as Promise<Locale>, getTranslations("HomeFooter"), getTranslations("InfoPages"), getTranslations("Metadata"), getTranslations("Legal"), getTranslations("LegalCleanup"),
  ]);
  const titleKey = pageTitleKeys[slug];
  if (!titleKey) return { robots: { index: false, follow: false } };
  const policyKind = policyKinds[slug as keyof typeof policyKinds];
  const cleanupKind = cleanupKinds[slug as keyof typeof cleanupKinds];
  const title = policyKind ? legal(`${policyKind}.title`) : cleanupKind ? legalCleanup(`${cleanupKind}.title`) : footer(titleKey);
  const isPublicInfo = publicInfoSlugs.includes(slug as (typeof publicInfoSlugs)[number]);
  const description = concise(isPublicInfo ? infoPages(`pages.${slug}.intro`) : policyKind ? legal(`${policyKind}.intro`) : cleanupKind ? legalCleanup(`${cleanupKind}.intro`) : `${title}. ${metadataText("description")}`);
  const pathname = `info/${slug}`;
  const canonical = localizedPath(locale, pathname);
  return {
    title,
    description,
    alternates: localizedAlternates(locale, pathname),
    openGraph: { type: "article", title: `${title} · Todijo`, description, url: canonical },
    twitter: { card: "summary", title: `${title} · Todijo`, description },
  };
}

export default async function MarketplaceInfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const titleKey = pageTitleKeys[slug];
  if (!titleKey) notFound();
  const [locale, t, legal, legalCleanup, sellerTransparency, infoPages] = await Promise.all([getLocale(), getTranslations("HomeFooter"), getTranslations("Legal"), getTranslations("LegalCleanup"), getTranslations("SellerTransparency"), getTranslations("InfoPages")]);
  const isLegal = legalPages.includes(slug as (typeof legalPages)[number]) || slug === "privacy-data";
  const profile = privacyPublicProfile();
  const isPublicInfo = publicInfoSlugs.includes(slug as (typeof publicInfoSlugs)[number]);
  const relatedLabel = (target: string) => target === "dashboard" ? t("sellerDashboard") : target === "seller-terms" ? legal("seller.title") : t(pageTitleKeys[target]);
  return <main className={`marketInfoPage scopedPublicPage${isLegal ? " legalInfoPage" : ""}`}>
    <SiteHeader />
    <div className="marketInfoLayout">
      {["privacy", "cookies", "privacy-data"].includes(slug) ? <PrivacyInformation kind={slug as "privacy" | "cookies" | "privacy-data"} supportEmail={profile.supportEmail} />
      : slug in policyKinds ? <MarketplaceLegalPolicy title={legal(`${policyKinds[slug as keyof typeof policyKinds]}.title`)} intro={legal(`${policyKinds[slug as keyof typeof policyKinds]}.intro`)} statusNote={legal("common.preIncorporation")} traderNote={slug === "seller-terms" || slug === "returns" ? sellerTransparency("legalStatusNote") : undefined} sections={legal.raw(`${policyKinds[slug as keyof typeof policyKinds]}.sections`) as Array<{ title: string; body: string }>} supportEmail={profile.supportEmail}/>
      : slug in cleanupKinds ? <MarketplaceLegalPolicy title={legalCleanup(`${cleanupKinds[slug as keyof typeof cleanupKinds]}.title`)} intro={legalCleanup(`${cleanupKinds[slug as keyof typeof cleanupKinds]}.intro`)} statusNote={legal("common.preIncorporation")} sections={legalCleanup.raw(`${cleanupKinds[slug as keyof typeof cleanupKinds]}.sections`) as Array<{title:string;body:string}>} supportEmail={profile.supportEmail} relatedLinks={slug === "marketplace-rules" ? [{label:legalCleanup("links.terms"),href:`/${locale}/info/terms`},{label:legalCleanup("links.sellerTerms"),href:`/${locale}/info/seller-terms`},{label:legalCleanup("links.returns"),href:`/${locale}/info/returns`}] : []}/>
      : isPublicInfo ? <MarketplaceInfoContent content={infoPages.raw(`pages.${slug}`) as {eyebrow:string;title:string;intro:string;sections:Array<{title:string;body:string}>}} relatedTitle={infoPages("relatedTitle")} relatedLinks={related[slug as keyof typeof related].map((target) => ({label: relatedLabel(target), href: target === "dashboard" ? `/${locale}/dashboard` : `/${locale}/info/${target}`}))} supportEmail={["contact","support","report-problem"].includes(slug) ? profile.supportEmail : undefined}/> : null}
      {isLegal && <aside className="marketInfoLegalNav"><h2>{t("legalTitle")}</h2><nav aria-label={t("legalTitle")}>{legalPages.map((legalSlug) => <Link className={legalSlug === slug ? "isActive" : ""} href={`/${locale}/info/${legalSlug}`} key={legalSlug}>{legalSlug === "seller-terms" ? legal("seller.title") : t(legalTitleKeys[legalSlug])}</Link>)}</nav></aside>}
    </div>
    <MarketplaceFooter />
  </main>;
}
