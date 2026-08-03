"use client";

import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localizedHome } from "@/lib/auth-redirects";

export default function ForgotPasswordPage() {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), locale }) });
    } finally {
      setSent(true);
      setLoading(false);
    }
  }

  return <main className="authPage"><section className="authBrand"><a className="authLogo" href={localizedHome(locale)}>Todijo<span>.</span></a><div className="authPitch"><h1>{t("forgotTitle")}</h1><p>{t("forgotIntro")}</p></div><small>© 2026 Todijo</small></section><section className="authPanel"><div className="authBox"><a className="authBack" href={`${localizedHome(locale)}/login`}>← {t("backToLogin")}</a><h2>{t("forgotTitle")}</h2><p className="authIntro">{t("forgotIntro")}</p>{sent ? <p className="authMessage isSuccess" role="status">{t("forgotNeutral")}</p> : <form className="authForm" onSubmit={submit}><div className="formField"><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" autoComplete="email" required/></div><button className="authSubmit" type="submit" disabled={loading}>{loading ? t("forgotSending") : t("forgotSubmit")}</button></form>}</div></section></main>;
}
