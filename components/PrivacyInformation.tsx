"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Cookie, Database, Mail, ShieldCheck } from "lucide-react";
import { OPEN_COOKIE_PREFERENCES_EVENT, storageInventory } from "@/lib/privacy-consent";

export default function PrivacyInformation({ kind }: { kind: "privacy" | "cookies" | "privacy-data" }) {
  const t = useTranslations("Privacy");
  const locale = useLocale();
  if (kind === "cookies") return <article className="privacyDocument"><header><Cookie size={30}/><h1>{t("cookiePolicyTitle")}</h1><p>{t("cookiePolicyIntro")}</p></header><section><div className="privacyInventory">{storageInventory.map((item) => <div key={item.id}><code>{item.id}</code><strong>{item.category === "essential" ? t("essentialTitle") : t("preferencesTitle")}</strong><span>{item.medium}</span><small>{item.lifetime}</small></div>)}</div><button className="privacyPrimary" type="button" onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))}>{t("manageCookies")}</button></section></article>;
  if (kind === "privacy-data") return <article className="privacyDocument"><header><Database size={30}/><h1>{t("privacyDataTitle")}</h1><p>{t("privacyDataIntro")}</p></header><section><h2>{t("rightsHeading")}</h2><p>{t("rightsText")}</p></section><section><h2>{t("requestHeading")}</h2><p>{t("requestText")}</p><div className="privacyActions"><Link className="privacyPrimary" href={`/${locale}/info/contact`}>{t("contactPrivacy")}</Link><button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))}>{t("manageCookies")}</button></div></section></article>;
  const sections = ["identity", "data", "marketplace", "purposes", "providers", "retention", "rights", "security", "updates"] as const;
  return <article className="privacyDocument"><header><ShieldCheck size={30}/><h1>{t("privacyPolicyTitle")}</h1><p>{t("privacyPolicyIntro")}</p></header>{sections.map((section) => <section key={section}><h2>{t(`${section}Heading`)}</h2><p>{t(`${section}Text`)}</p>{section === "rights" && <Link className="privacyInlineLink" href={`/${locale}/info/privacy-data`}>{t("privacyData")}</Link>}</section>)}<section><Link className="privacyPrimary" href={`/${locale}/info/contact`}><Mail size={17}/>{t("contactPrivacy")}</Link></section></article>;
}
