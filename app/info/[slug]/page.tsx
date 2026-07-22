import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import TodijoLogo from "@/components/TodijoLogo";

const pageTitleKeys: Record<string, string> = {
  about: "about", "how-it-works": "howItWorks", mission: "mission", help: "helpCenter",
  "how-to-buy": "howToBuy", "how-to-sell": "howToSell", delivery: "delivery", returns: "returns",
  safety: "safety", "seller-guide": "sellerGuide", contact: "contact", support: "support",
  "report-problem": "reportProblem", terms: "terms", privacy: "privacy", cookies: "cookies",
  "legal-notice": "legalNotice", "marketplace-rules": "rules",
};

export default async function MarketplaceInfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const titleKey = pageTitleKeys[slug];
  if (!titleKey) notFound();
  const [locale, t] = await Promise.all([getLocale(), getTranslations("HomeFooter")]);

  return <main className="marketInfoPage">
    <header><TodijoLogo href={`/${locale}`}/></header>
    <section>
      <span><Clock3 size={22} aria-hidden="true"/>{t("comingSoon")}</span>
      <h1>{t(titleKey)}</h1>
      <p>{t("comingSoonText")}</p>
      <Link href={`/${locale}`}><ArrowLeft size={18} aria-hidden="true"/>{t("backHome")}</Link>
    </section>
  </main>;
}
