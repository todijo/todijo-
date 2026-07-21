"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeCookie, locales, type Locale } from "@/i18n/config";

const names: Record<Locale, string> = { en: "English", fr: "Français", ar: "العربية", ku: "کوردی", tr: "Türkçe", de: "Deutsch", es: "Español", it: "Italiano", nl: "Nederlands" };

export default function LanguageSwitcher({ className = "languageSwitcher" }: { className?: string }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Common");
  return <label className={className}><span className="srOnly">{t("language")}</span><select value={locale} aria-label={t("language")} onChange={(event) => { const next = event.target.value as Locale; document.cookie = `${localeCookie}=${next};path=/;max-age=31536000;samesite=lax`; router.replace(pathname, { locale: next }); }}>
    {locales.map((item) => <option key={item} value={item}>{names[item]}</option>)}
  </select></label>;
}
