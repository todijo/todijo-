"use client";

import { useLocale, useTranslations } from "next-intl";
import { localeCookie, locales, type Locale } from "@/i18n/config";
import { buildLocalizedPath } from "@/lib/locale-routing";

const names: Record<Locale, string> = { en: "English", fr: "Français", ar: "العربية", ku: "کوردی", tr: "Türkçe", de: "Deutsch", es: "Español", it: "Italiano", nl: "Nederlands", zh: "简体中文", fa: "فارسی", hi: "हिन्दी", pt: "Português", ru: "Русский" };

export default function LanguageSwitcher({ className = "languageSwitcher" }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("Common");
  return <label className={className}><span className="srOnly">{t("language")}</span><select value={locale} aria-label={t("language")} onChange={(event) => { const next = event.target.value as Locale; const path = buildLocalizedPath(window.location.pathname, next, window.location.search, window.location.hash); const localizedUrl = new URL(path, window.location.origin).href; document.cookie = `${localeCookie}=${next};path=/;max-age=31536000;samesite=lax`; window.location.href = localizedUrl; }}>
    {locales.map((item) => <option key={item} value={item}>{names[item]}</option>)}
  </select></label>;
}
