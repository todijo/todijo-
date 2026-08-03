"use client";

import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { localizedHome } from "@/lib/auth-redirects";

export default function ResetPasswordPage() {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) return setMessage(t("passwordMismatch"));
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: params.get("token"), password, confirmPassword }) });
      const data: { code?: string } = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.code === "PASSWORD_MISMATCH" ? t("passwordMismatch") : data.code === "INVALID_PASSWORD" ? t("invalidPassword") : data.code === "EXPIRED" ? t("verificationExpiredResult") : data.code === "ALREADY_USED" ? t("verificationUsedResult") : t("verificationInvalidResult"));
        return;
      }
      router.replace(`${localizedHome(locale)}/login?reset=success`);
    } catch {
      setMessage(t("error"));
    } finally {
      setLoading(false);
    }
  }

  return <main className="authPage"><section className="authBrand"><a className="authLogo" href={localizedHome(locale)}>Todijo<span>.</span></a><div className="authPitch"><h1>{t("resetTitle")}</h1><p>{t("resetIntro")}</p></div><small>© 2026 Todijo</small></section><section className="authPanel"><div className="authBox"><a className="authBack" href={`${localizedHome(locale)}/login`}>← {t("backToLogin")}</a><h2>{t("resetTitle")}</h2><p className="authIntro">{t("resetIntro")}</p><form className="authForm" onSubmit={submit}><div className="formField"><label htmlFor="password">{t("newPassword")}</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required/></div><div className="formField"><label htmlFor="confirmPassword">{t("confirmPassword")}</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required/></div>{message && <p className="authMessage" role="alert">{message}</p>}<button className="authSubmit" type="submit" disabled={loading || !params.get("token")}>{loading ? t("resetting") : t("resetSubmit")}</button></form></div></section></main>;
}
